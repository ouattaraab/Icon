<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\Machine;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MachineController extends Controller
{
    public function index(Request $request): Response
    {
        $machines = Machine::query()
            ->when($request->query('status'), fn ($q, $status) => $q->where('status', $status))
            ->when($request->query('os'), fn ($q, $os) => $q->where('os', $os))
            ->when($request->query('search'), fn ($q, $search) =>
                $q->where('hostname', 'ilike', "%{$search}%")
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
            ]);

        return Inertia::render('Machines/Index', [
            'machines' => $machines,
            'filters' => $request->only(['status', 'os', 'search']),
        ]);
    }

    public function show(Machine $machine): Response
    {
        $machine->load(['events' => fn ($q) => $q->latest('occurred_at')->limit(50)]);

        $stats = [
            'total_events' => $machine->events()->count(),
            'blocked_events' => $machine->events()->where('event_type', 'block')->count(),
            'alerts_count' => $machine->alerts()->where('status', 'open')->count(),
            'platforms_used' => $machine->events()
                ->whereNotNull('platform')
                ->distinct('platform')
                ->pluck('platform'),
        ];

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
                'acknowledged_at' => $a->acknowledged_at?->diffForHumans(),
            ]);

        return Inertia::render('Machines/Show', [
            'machine' => $machine,
            'stats' => $stats,
            'alerts' => $alerts,
        ]);
    }
}
