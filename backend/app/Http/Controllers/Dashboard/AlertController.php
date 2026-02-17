<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AlertController extends Controller
{
    public function index(Request $request): Response
    {
        $alerts = Alert::with(['machine:id,hostname', 'rule:id,name'])
            ->when($request->query('status'), fn ($q, $status) => $q->where('status', $status))
            ->when($request->query('severity'), fn ($q, $sev) => $q->where('severity', $sev))
            ->when($request->query('machine_id'), fn ($q, $id) => $q->where('machine_id', $id))
            ->orderBy('created_at', 'desc')
            ->paginate(25);

        $openCount = Alert::where('status', 'open')->count();
        $criticalCount = Alert::where('status', 'open')->where('severity', 'critical')->count();

        return Inertia::render('Alerts/Index', [
            'alerts' => $alerts,
            'openCount' => $openCount,
            'criticalCount' => $criticalCount,
            'filters' => $request->only(['status', 'severity', 'machine_id']),
        ]);
    }

    public function show(Alert $alert): Response
    {
        $alert->load([
            'machine:id,hostname,os,os_version,department,assigned_user,status',
            'rule:id,name,category,target,condition_type',
            'event',
            'acknowledgedBy:id,name',
        ]);

        // Related alerts on same machine (last 10, excluding current)
        $relatedAlerts = Alert::with('rule:id,name')
            ->where('machine_id', $alert->machine_id)
            ->where('id', '!=', $alert->id)
            ->orderByDesc('created_at')
            ->limit(10)
            ->get()
            ->map(fn ($a) => [
                'id' => $a->id,
                'severity' => $a->severity,
                'title' => $a->title,
                'status' => $a->status,
                'rule_name' => $a->rule?->name,
                'created_at' => $a->created_at?->diffForHumans(),
            ]);

        return Inertia::render('Alerts/Show', [
            'alert' => [
                'id' => $alert->id,
                'severity' => $alert->severity,
                'title' => $alert->title,
                'description' => $alert->description,
                'status' => $alert->status,
                'created_at' => $alert->created_at?->toIso8601String(),
                'created_at_human' => $alert->created_at?->diffForHumans(),
                'acknowledged_at' => $alert->acknowledged_at?->toIso8601String(),
                'acknowledged_at_human' => $alert->acknowledged_at?->diffForHumans(),
                'acknowledged_by_name' => $alert->acknowledgedBy?->name,
                'event_id' => $alert->event_id,
                'event' => $alert->event ? [
                    'id' => $alert->event->id,
                    'event_type' => $alert->event->event_type,
                    'platform' => $alert->event->platform,
                    'domain' => $alert->event->domain,
                    'severity' => $alert->event->severity,
                    'elasticsearch_id' => $alert->event->elasticsearch_id,
                    'occurred_at' => $alert->event->occurred_at?->toIso8601String(),
                ] : null,
                'machine' => $alert->machine ? [
                    'id' => $alert->machine->id,
                    'hostname' => $alert->machine->hostname,
                    'os' => $alert->machine->os,
                    'os_version' => $alert->machine->os_version,
                    'department' => $alert->machine->department,
                    'assigned_user' => $alert->machine->assigned_user,
                    'status' => $alert->machine->status,
                ] : null,
                'rule' => $alert->rule ? [
                    'id' => $alert->rule->id,
                    'name' => $alert->rule->name,
                    'category' => $alert->rule->category,
                    'target' => $alert->rule->target,
                    'condition_type' => $alert->rule->condition_type,
                ] : null,
            ],
            'relatedAlerts' => $relatedAlerts,
        ]);
    }

    public function acknowledge(Alert $alert): \Illuminate\Http\RedirectResponse
    {
        $alert->update([
            'status' => 'acknowledged',
            'acknowledged_by' => auth()->id(),
            'acknowledged_at' => now(),
        ]);

        AuditLog::log('alert.acknowledged', 'Alert', $alert->id);

        return back();
    }

    public function resolve(Alert $alert): \Illuminate\Http\RedirectResponse
    {
        $alert->update(['status' => 'resolved']);

        AuditLog::log('alert.resolved', 'Alert', $alert->id);

        return back();
    }

    public function exportCsv(Request $request): StreamedResponse
    {
        $query = Alert::with(['machine:id,hostname', 'rule:id,name'])
            ->when($request->query('status'), fn ($q, $status) => $q->where('status', $status))
            ->when($request->query('severity'), fn ($q, $sev) => $q->where('severity', $sev))
            ->when($request->query('machine_id'), fn ($q, $id) => $q->where('machine_id', $id))
            ->orderBy('created_at', 'desc');

        $filename = 'icon-alertes-' . now()->format('Y-m-d') . '.csv';

        AuditLog::log('alert.export_csv', 'Alert', null, [
            'filters' => $request->only(['status', 'severity', 'machine_id']),
        ]);

        return response()->streamDownload(function () use ($query) {
            $out = fopen('php://output', 'w');
            fprintf($out, chr(0xEF) . chr(0xBB) . chr(0xBF));

            fputcsv($out, [
                'Date', 'Sévérité', 'Titre', 'Description', 'Statut',
                'Machine', 'Règle', 'Prise en charge le',
            ], ';');

            $query->chunk(500, function ($alerts) use ($out) {
                foreach ($alerts as $alert) {
                    fputcsv($out, [
                        $alert->created_at?->format('Y-m-d H:i:s'),
                        $alert->severity,
                        $alert->title,
                        $alert->description ?? '',
                        $alert->status,
                        $alert->machine?->hostname ?? '',
                        $alert->rule?->name ?? '',
                        $alert->acknowledged_at?->format('Y-m-d H:i:s') ?? '',
                    ], ';');
                }
            });

            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
