<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\Event;
use App\Models\Machine;
use App\Models\Setting;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(): Response
    {
        $now = now();

        $offlineThreshold = (int) Setting::getValue('offline_threshold_seconds', 300);

        // Summary stats
        $stats = [
            'total_machines' => Machine::count(),
            'online_machines' => Machine::where('last_heartbeat', '>', $now->copy()->subSeconds($offlineThreshold))->count(),
            'total_events' => Event::where('created_at', '>', $now->copy()->subDays(30))->count(),
            'blocked_events' => Event::where('event_type', 'block')
                ->where('created_at', '>', $now->copy()->subDays(30))->count(),
            'open_alerts' => Alert::where('status', 'open')->count(),
            'critical_alerts' => Alert::where('status', 'open')->where('severity', 'critical')->count(),
            'events_today' => Event::where('occurred_at', '>=', $now->copy()->startOfDay())->count(),
            'blocked_today' => Event::where('event_type', 'block')
                ->where('occurred_at', '>=', $now->copy()->startOfDay())->count(),
            'agent_version' => Setting::getValue('agent_current_version', '0.1.0'),
        ];

        // Activity last 24h — hourly event counts
        $driver = DB::connection()->getDriverName();
        $hourExpr = $driver === 'sqlite'
            ? "strftime('%Y-%m-%d %H:00:00', occurred_at)"
            : "date_trunc('hour', occurred_at)";

        $activity24h = Event::where('occurred_at', '>', $now->copy()->subHours(24))
            ->select(
                DB::raw("{$hourExpr} as hour"),
                DB::raw('COUNT(*) as count'),
            )
            ->groupBy('hour')
            ->orderBy('hour')
            ->get()
            ->map(fn ($row) => [
                'hour' => \Carbon\Carbon::parse($row->hour)->format('H:i'),
                'count' => $row->count,
            ]);

        // Platform usage (last 30 days)
        $platformUsage = Event::where('occurred_at', '>', $now->copy()->subDays(30))
            ->whereNotNull('platform')
            ->select('platform', DB::raw('COUNT(*) as count'))
            ->groupBy('platform')
            ->orderByDesc('count')
            ->limit(8)
            ->get();

        // Recent alerts (last 10 open)
        $recentAlerts = Alert::with('machine:id,hostname')
            ->where('status', 'open')
            ->orderByDesc('created_at')
            ->limit(10)
            ->get()
            ->map(fn (Alert $a) => [
                'id' => $a->id,
                'severity' => $a->severity,
                'title' => $a->title,
                'machine' => $a->machine?->hostname,
                'created_at' => $a->created_at?->diffForHumans(),
            ]);

        // Top 5 machines by event volume (last 7 days)
        $topMachines = Event::where('occurred_at', '>', $now->copy()->subDays(7))
            ->select('machine_id', DB::raw('COUNT(*) as event_count'))
            ->groupBy('machine_id')
            ->orderByDesc('event_count')
            ->limit(5)
            ->get()
            ->map(function ($row) {
                $machine = Machine::find($row->machine_id);
                return [
                    'machine_id' => $row->machine_id,
                    'hostname' => $machine?->hostname ?? $row->machine_id,
                    'event_count' => $row->event_count,
                ];
            });

        // 7-day daily event trend
        $dateExpr = $driver === 'sqlite'
            ? "DATE(occurred_at)"
            : "DATE(occurred_at)";

        $dailyEvents = Event::where('occurred_at', '>=', $now->copy()->subDays(7)->startOfDay())
            ->select(
                DB::raw("{$dateExpr} as date"),
                DB::raw('COUNT(*) as total'),
                DB::raw("SUM(CASE WHEN event_type = 'block' THEN 1 ELSE 0 END) as blocked"),
            )
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->map(fn ($row) => [
                'date' => $row->date,
                'total' => (int) $row->total,
                'blocked' => (int) $row->blocked,
            ]);

        return Inertia::render('Dashboard/Index', [
            'stats' => $stats,
            'activity24h' => $activity24h,
            'platformUsage' => $platformUsage,
            'recentAlerts' => $recentAlerts,
            'topMachines' => $topMachines,
            'dailyEvents' => $dailyEvents,
        ]);
    }
}
