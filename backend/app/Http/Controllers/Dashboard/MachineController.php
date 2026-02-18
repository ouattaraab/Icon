<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Machine;
use App\Models\Tag;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MachineController extends Controller
{
    public function index(Request $request): Response
    {
        $machines = Machine::query()
            ->with('tags:id,name,color')
            ->when($request->query('status'), fn ($q, $status) => $q->where('status', $status))
            ->when($request->query('os'), fn ($q, $os) => $q->where('os', $os))
            ->when($request->query('tag'), fn ($q, $tagId) => $q->whereHas('tags', fn ($tq) => $tq->where('tags.id', $tagId))
            )
            ->when($request->query('search'), fn ($q, $search) => $q->where('hostname', 'ilike', "%{$search}%")
                ->orWhere('assigned_user', 'ilike', "%{$search}%")
            )
            ->orderBy('last_heartbeat', 'desc')
            ->paginate(25)
            ->through(fn (Machine $m) => [
                'id' => $m->id,
                'hostname' => $m->hostname,
                'os' => $m->os,
                'os_version' => $m->os_version,
                'agent_version' => $m->agent_version,
                'status' => $m->isOnline() ? 'online' : $m->status,
                'last_heartbeat' => $m->last_heartbeat?->diffForHumans(),
                'department' => $m->department,
                'assigned_user' => $m->assigned_user,
                'ip_address' => $m->ip_address,
                'tags' => $m->tags->map(fn ($t) => [
                    'id' => $t->id,
                    'name' => $t->name,
                    'color' => $t->color,
                ])->toArray(),
            ]);

        $tags = Tag::orderBy('name')->get(['id', 'name', 'color']);

        return Inertia::render('Machines/Index', [
            'machines' => $machines,
            'filters' => $request->only(['status', 'os', 'search', 'tag']),
            'tags' => $tags,
        ]);
    }

    public function show(Machine $machine): Response
    {
        $machine->load(['events' => fn ($q) => $q->latest('occurred_at')->limit(50), 'tags:id,name,color']);

        $stats = [
            'total_events' => $machine->events()->count(),
            'blocked_events' => $machine->events()->where('event_type', 'block')->count(),
            'alerts_count' => $machine->alerts()->where('status', 'open')->count(),
            'platforms_used' => $machine->events()
                ->whereNotNull('platform')
                ->distinct('platform')
                ->pluck('platform'),
        ];

        // Daily activity for the last 14 days
        $dailyActivity = $machine->events()
            ->where('occurred_at', '>=', now()->subDays(14))
            ->selectRaw("DATE(occurred_at) as date, COUNT(*) as total, SUM(CASE WHEN event_type = 'block' THEN 1 ELSE 0 END) as blocked")
            ->groupByRaw('DATE(occurred_at)')
            ->orderBy('date')
            ->get()
            ->map(fn ($row) => [
                'date' => $row->date,
                'total' => (int) $row->total,
                'blocked' => (int) $row->blocked,
            ]);

        // Event type distribution
        $eventTypes = $machine->events()
            ->selectRaw('event_type, COUNT(*) as count')
            ->groupBy('event_type')
            ->orderByDesc('count')
            ->pluck('count', 'event_type');

        // Recent alerts for this machine
        $alerts = $machine->alerts()
            ->with('rule:id,name')
            ->latest('created_at')
            ->limit(20)
            ->get()
            ->map(fn ($a) => [
                'id' => $a->id,
                'severity' => $a->severity,
                'title' => $a->title,
                'description' => $a->description,
                'status' => $a->status,
                'rule_name' => $a->rule?->name,
                'created_at' => $a->created_at?->diffForHumans(),
                'created_at_full' => $a->created_at?->toIso8601String(),
                'acknowledged_at' => $a->acknowledged_at?->diffForHumans(),
            ]);

        // Platform usage breakdown with counts
        $platformBreakdown = $machine->events()
            ->whereNotNull('platform')
            ->selectRaw('platform, COUNT(*) as total, SUM(CASE WHEN event_type = \'block\' THEN 1 ELSE 0 END) as blocked')
            ->groupBy('platform')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'platform' => $row->platform,
                'total' => (int) $row->total,
                'blocked' => (int) $row->blocked,
            ]);

        // Hourly activity heatmap (last 7 days, grouped by hour of day)
        $hourlyActivity = $machine->events()
            ->where('occurred_at', '>=', now()->subDays(7))
            ->selectRaw('EXTRACT(HOUR FROM occurred_at)::integer as hour, COUNT(*) as count')
            ->groupByRaw('EXTRACT(HOUR FROM occurred_at)')
            ->orderBy('hour')
            ->pluck('count', 'hour')
            ->toArray();

        // Pending commands for this machine
        $pendingCommands = cache()->get("machine:{$machine->id}:commands", []);

        return Inertia::render('Machines/Show', [
            'machine' => $machine,
            'stats' => $stats,
            'dailyActivity' => $dailyActivity,
            'eventTypes' => $eventTypes,
            'alerts' => $alerts,
            'platformBreakdown' => $platformBreakdown,
            'hourlyActivity' => $hourlyActivity,
            'pendingCommands' => $pendingCommands,
        ]);
    }

    public function update(Request $request, Machine $machine): RedirectResponse
    {
        $validated = $request->validate([
            'department' => 'nullable|string|max:255',
            'assigned_user' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:5000',
        ]);

        $changes = [];
        foreach (['department', 'assigned_user', 'notes'] as $field) {
            if (array_key_exists($field, $validated) && $validated[$field] !== $machine->$field) {
                $changes[$field] = ['old' => $machine->$field, 'new' => $validated[$field]];
            }
        }

        $machine->update($validated);

        if (! empty($changes)) {
            AuditLog::log('machine.updated', 'Machine', $machine->id, [
                'hostname' => $machine->hostname,
                'changes' => $changes,
            ]);
        }

        return redirect()->back()->with('success', 'Machine mise à jour.');
    }

    public function forceSyncRules(Machine $machine): RedirectResponse
    {
        $commands = cache()->get("machine:{$machine->id}:commands", []);
        $commands[] = ['type' => 'force_sync_rules', 'issued_at' => now()->toIso8601String()];
        cache()->put("machine:{$machine->id}:commands", $commands, now()->addHours(1));

        AuditLog::log('machine.force_sync', 'Machine', $machine->id, [
            'hostname' => $machine->hostname,
        ]);

        return redirect()->back()->with('success', 'Synchronisation des règles demandée.');
    }

    public function restartAgent(Machine $machine): RedirectResponse
    {
        $commands = cache()->get("machine:{$machine->id}:commands", []);
        $commands[] = ['type' => 'restart', 'issued_at' => now()->toIso8601String()];
        cache()->put("machine:{$machine->id}:commands", $commands, now()->addHours(1));

        AuditLog::log('machine.restart', 'Machine', $machine->id, [
            'hostname' => $machine->hostname,
        ]);

        return redirect()->back()->with('success', 'Redémarrage de l\'agent demandé.');
    }

    public function toggleStatus(Machine $machine): RedirectResponse
    {
        $newStatus = $machine->status === 'inactive' ? 'active' : 'inactive';
        $machine->update(['status' => $newStatus]);

        AuditLog::log('machine.status_changed', 'Machine', $machine->id, [
            'hostname' => $machine->hostname,
            'old_status' => $machine->getOriginal('status'),
            'new_status' => $newStatus,
        ]);

        $label = $newStatus === 'inactive' ? 'désactivée' : 'réactivée';

        return redirect()->back()->with('success', "Machine {$label}.");
    }

    public function bulkAction(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'machine_ids' => 'required|array|min:1',
            'machine_ids.*' => 'uuid|exists:machines,id',
            'action' => 'required|string|in:force_sync,restart,disable',
        ]);

        $machines = Machine::whereIn('id', $validated['machine_ids'])->get();
        $count = $machines->count();

        foreach ($machines as $machine) {
            match ($validated['action']) {
                'force_sync' => $this->queueCommand($machine, 'force_sync_rules', 'machine.force_sync'),
                'restart' => $this->queueCommand($machine, 'restart', 'machine.restart'),
                'disable' => $this->disableMachine($machine),
            };
        }

        $actionLabel = match ($validated['action']) {
            'force_sync' => 'Synchronisation demandée',
            'restart' => 'Redémarrage demandé',
            'disable' => 'Désactivation effectuée',
        };

        return redirect()->back()->with('success', "{$actionLabel} pour {$count} machine(s).");
    }

    private function queueCommand(Machine $machine, string $type, string $auditAction): void
    {
        $commands = cache()->get("machine:{$machine->id}:commands", []);
        $commands[] = ['type' => $type, 'issued_at' => now()->toIso8601String()];
        cache()->put("machine:{$machine->id}:commands", $commands, now()->addHours(1));

        AuditLog::log($auditAction, 'Machine', $machine->id, [
            'hostname' => $machine->hostname,
            'bulk' => true,
        ]);
    }

    private function disableMachine(Machine $machine): void
    {
        if ($machine->status === 'inactive') {
            return;
        }

        $oldStatus = $machine->status;
        $machine->update(['status' => 'inactive']);

        AuditLog::log('machine.status_changed', 'Machine', $machine->id, [
            'hostname' => $machine->hostname,
            'old_status' => $oldStatus,
            'new_status' => 'inactive',
            'bulk' => true,
        ]);
    }
}
