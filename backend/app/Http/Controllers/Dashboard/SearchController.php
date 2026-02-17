<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\Machine;
use App\Models\Rule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SearchController extends Controller
{
    public function suggestions(Request $request): JsonResponse
    {
        $query = trim($request->query('q', ''));
        $suggestions = [];

        if (strlen($query) < 2) {
            return response()->json($suggestions);
        }

        $like = "%{$query}%";

        // Machines (max 4)
        Machine::where('hostname', 'like', $like)
            ->orWhere('assigned_user', 'like', $like)
            ->orderByDesc('last_heartbeat')
            ->limit(4)
            ->get()
            ->each(function (Machine $m) use (&$suggestions) {
                $suggestions[] = [
                    'type' => 'machine',
                    'label' => $m->hostname,
                    'sub' => $m->assigned_user ?: $m->os,
                    'href' => "/machines/{$m->id}",
                ];
            });

        // Alerts (max 3)
        Alert::with('machine:id,hostname')
            ->where('title', 'like', $like)
            ->orderByDesc('created_at')
            ->limit(3)
            ->get()
            ->each(function (Alert $a) use (&$suggestions) {
                $suggestions[] = [
                    'type' => 'alert',
                    'label' => $a->title,
                    'sub' => $a->machine?->hostname ?: $a->severity,
                    'href' => '/alerts',
                ];
            });

        // Rules (max 3)
        Rule::where('name', 'like', $like)
            ->limit(3)
            ->get()
            ->each(function (Rule $r) use (&$suggestions) {
                $suggestions[] = [
                    'type' => 'rule',
                    'label' => $r->name,
                    'sub' => $r->category,
                    'href' => '/rules',
                ];
            });

        return response()->json($suggestions);
    }

    public function __invoke(Request $request): Response
    {
        $query = trim($request->query('q', ''));

        $results = [
            'machines' => [],
            'alerts' => [],
        ];

        if (strlen($query) >= 2) {
            $like = "%{$query}%";

            $results['machines'] = Machine::query()
                ->where(function ($q) use ($like) {
                    $q->where('hostname', 'like', $like)
                      ->orWhere('assigned_user', 'like', $like)
                      ->orWhere('department', 'like', $like)
                      ->orWhere('ip_address', 'like', $like);
                })
                ->orderByDesc('last_heartbeat')
                ->limit(10)
                ->get()
                ->map(fn (Machine $m) => [
                    'id' => $m->id,
                    'hostname' => $m->hostname,
                    'os' => $m->os,
                    'status' => $m->isOnline() ? 'online' : $m->status,
                    'assigned_user' => $m->assigned_user,
                    'department' => $m->department,
                    'last_heartbeat' => $m->last_heartbeat?->diffForHumans(),
                ]);

            $results['alerts'] = Alert::with('machine:id,hostname')
                ->where(function ($q) use ($like) {
                    $q->where('title', 'like', $like)
                      ->orWhere('description', 'like', $like);
                })
                ->orderByDesc('created_at')
                ->limit(15)
                ->get()
                ->map(fn (Alert $a) => [
                    'id' => $a->id,
                    'title' => $a->title,
                    'severity' => $a->severity,
                    'status' => $a->status,
                    'machine' => $a->machine?->hostname,
                    'created_at' => $a->created_at?->diffForHumans(),
                ]);
        }

        return Inertia::render('Search/Index', [
            'query' => $query,
            'results' => $results,
        ]);
    }
}
