<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\AuditLog;
use App\Models\Event;
use App\Models\Machine;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Barryvdh\DomPDF\Facade\Pdf;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function index(Request $request): Response
    {
        $dateFrom = $request->query('date_from', now()->subDays(30)->toDateString());
        $dateTo = $request->query('date_to', now()->toDateString());

        // Usage by platform
        $platformUsage = Event::whereBetween('occurred_at', [$dateFrom, $dateTo])
            ->whereNotNull('platform')
            ->select('platform', DB::raw('COUNT(*) as count'))
            ->groupBy('platform')
            ->orderByDesc('count')
            ->get();

        // Alerts over time (daily)
        $alertsTrend = Alert::whereBetween('created_at', [$dateFrom, $dateTo])
            ->select(
                DB::raw("DATE(created_at) as date"),
                'severity',
                DB::raw('COUNT(*) as count')
            )
            ->groupBy('date', 'severity')
            ->orderBy('date')
            ->get();

        // Top machines by activity
        $topMachines = Event::whereBetween('occurred_at', [$dateFrom, $dateTo])
            ->select('machine_id', DB::raw('COUNT(*) as event_count'))
            ->groupBy('machine_id')
            ->orderByDesc('event_count')
            ->limit(10)
            ->with('machine:id,hostname,assigned_user,department')
            ->get();

        // Events by type breakdown
        $eventTypes = Event::whereBetween('occurred_at', [$dateFrom, $dateTo])
            ->select('event_type', DB::raw('COUNT(*) as count'))
            ->groupBy('event_type')
            ->orderByDesc('count')
            ->get();

        // Daily events timeline
        $dailyEvents = Event::whereBetween('occurred_at', [$dateFrom, $dateTo])
            ->select(
                DB::raw("DATE(occurred_at) as date"),
                DB::raw('COUNT(*) as total'),
                DB::raw("COUNT(CASE WHEN event_type = 'block' THEN 1 END) as blocked"),
                DB::raw("COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical")
            )
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        // Severity distribution
        $severityDistribution = Event::whereBetween('occurred_at', [$dateFrom, $dateTo])
            ->select('severity', DB::raw('COUNT(*) as count'))
            ->groupBy('severity')
            ->orderByDesc('count')
            ->get();

        // Summary stats
        $stats = [
            'total_machines' => Machine::where('status', 'active')->count(),
            'online_machines' => Machine::where('last_heartbeat', '>', now()->subMinutes(5))->count(),
            'total_events' => Event::whereBetween('occurred_at', [$dateFrom, $dateTo])->count(),
            'blocked_events' => Event::whereBetween('occurred_at', [$dateFrom, $dateTo])
                ->where('event_type', 'block')->count(),
            'open_alerts' => Alert::where('status', 'open')->count(),
            'critical_alerts' => Alert::where('status', 'open')->where('severity', 'critical')->count(),
        ];

        return Inertia::render('Reports/Index', [
            'stats' => $stats,
            'platformUsage' => $platformUsage,
            'alertsTrend' => $alertsTrend,
            'topMachines' => $topMachines,
            'eventTypes' => $eventTypes,
            'dailyEvents' => $dailyEvents,
            'severityDistribution' => $severityDistribution,
            'filters' => [
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
            ],
        ]);
    }

    /**
     * Export events as CSV
     */
    public function exportCsv(Request $request): StreamedResponse
    {
        $dateFrom = $request->query('date_from', now()->subDays(30)->toDateString());
        $dateTo = $request->query('date_to', now()->toDateString());
        $type = $request->query('type', 'events'); // events, alerts, machines

        $filename = "icon-{$type}-{$dateFrom}-{$dateTo}.csv";

        AuditLog::log('report.export_csv', 'Report', null, [
            'type' => $type,
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
        ]);

        return response()->streamDownload(function () use ($dateFrom, $dateTo, $type) {
            $handle = fopen('php://output', 'w');

            match ($type) {
                'events' => $this->exportEvents($handle, $dateFrom, $dateTo),
                'alerts' => $this->exportAlerts($handle, $dateFrom, $dateTo),
                'machines' => $this->exportMachines($handle),
                default => fputcsv($handle, ['Type d\'export non reconnu']),
            };

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    private function exportEvents($handle, string $dateFrom, string $dateTo): void
    {
        fputcsv($handle, [
            'Date',
            'Type',
            'Plateforme',
            'Domaine',
            'Sévérité',
            'Machine',
            'Utilisateur',
        ], ';');

        Event::with('machine:id,hostname,assigned_user')
            ->whereBetween('occurred_at', [$dateFrom, $dateTo])
            ->orderBy('occurred_at', 'desc')
            ->chunk(500, function ($events) use ($handle) {
                foreach ($events as $event) {
                    fputcsv($handle, [
                        $event->occurred_at?->format('Y-m-d H:i:s'),
                        $event->event_type,
                        $event->platform ?? '',
                        $event->domain ?? '',
                        $event->severity ?? '',
                        $event->machine?->hostname ?? '',
                        $event->machine?->assigned_user ?? '',
                    ], ';');
                }
            });
    }

    private function exportAlerts($handle, string $dateFrom, string $dateTo): void
    {
        fputcsv($handle, [
            'Date',
            'Sévérité',
            'Titre',
            'Statut',
            'Machine',
            'Règle',
        ], ';');

        Alert::with(['machine:id,hostname', 'rule:id,name'])
            ->whereBetween('created_at', [$dateFrom, $dateTo])
            ->orderBy('created_at', 'desc')
            ->chunk(500, function ($alerts) use ($handle) {
                foreach ($alerts as $alert) {
                    fputcsv($handle, [
                        $alert->created_at?->format('Y-m-d H:i:s'),
                        $alert->severity,
                        $alert->title,
                        $alert->status,
                        $alert->machine?->hostname ?? '',
                        $alert->rule?->name ?? '',
                    ], ';');
                }
            });
    }

    private function exportMachines($handle): void
    {
        fputcsv($handle, [
            'Hostname',
            'OS',
            'Version Agent',
            'Statut',
            'Dernier contact',
            'Département',
            'Utilisateur',
            'Adresse IP',
        ], ';');

        Machine::orderBy('hostname')
            ->chunk(500, function ($machines) use ($handle) {
                foreach ($machines as $machine) {
                    fputcsv($handle, [
                        $machine->hostname,
                        $machine->os . ' ' . $machine->os_version,
                        $machine->agent_version,
                        $machine->status,
                        $machine->last_heartbeat?->format('Y-m-d H:i:s') ?? '',
                        $machine->department ?? '',
                        $machine->assigned_user ?? '',
                        $machine->ip_address ?? '',
                    ], ';');
                }
            });
    }

    /**
     * Export a PDF report summary.
     */
    public function exportPdf(Request $request)
    {
        $dateFrom = $request->query('date_from', now()->subDays(30)->toDateString());
        $dateTo = $request->query('date_to', now()->toDateString());

        $platformUsage = Event::whereBetween('occurred_at', [$dateFrom, $dateTo])
            ->whereNotNull('platform')
            ->select('platform', DB::raw('COUNT(*) as count'))
            ->groupBy('platform')
            ->orderByDesc('count')
            ->get();

        $topMachines = Event::whereBetween('occurred_at', [$dateFrom, $dateTo])
            ->select('machine_id', DB::raw('COUNT(*) as event_count'))
            ->groupBy('machine_id')
            ->orderByDesc('event_count')
            ->limit(10)
            ->get()
            ->map(function ($item) {
                $machine = Machine::find($item->machine_id);
                $item->hostname = $machine?->hostname ?? 'Inconnu';
                $item->assigned_user = $machine?->assigned_user ?? '';
                $item->department = $machine?->department ?? '';
                return $item;
            });

        $stats = [
            'total_machines' => Machine::where('status', 'active')->count(),
            'online_machines' => Machine::where('last_heartbeat', '>', now()->subMinutes(5))->count(),
            'total_events' => Event::whereBetween('occurred_at', [$dateFrom, $dateTo])->count(),
            'blocked_events' => Event::whereBetween('occurred_at', [$dateFrom, $dateTo])
                ->where('event_type', 'block')->count(),
            'open_alerts' => Alert::where('status', 'open')->count(),
            'critical_alerts' => Alert::where('status', 'open')->where('severity', 'critical')->count(),
        ];

        $recentAlerts = Alert::with('machine:id,hostname')
            ->whereBetween('created_at', [$dateFrom, $dateTo])
            ->orderByDesc('created_at')
            ->limit(20)
            ->get();

        AuditLog::log('report.export_pdf', 'Report', null, [
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
        ]);

        $pdf = Pdf::loadView('reports.pdf', [
            'stats' => $stats,
            'platformUsage' => $platformUsage,
            'topMachines' => $topMachines,
            'recentAlerts' => $recentAlerts,
            'dateFrom' => $dateFrom,
            'dateTo' => $dateTo,
            'generatedAt' => now()->format('d/m/Y H:i'),
        ])->setPaper('a4', 'portrait');

        return $pdf->download("icon-rapport-{$dateFrom}-{$dateTo}.pdf");
    }
}
