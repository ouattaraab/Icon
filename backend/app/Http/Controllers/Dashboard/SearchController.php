<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\Machine;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SearchController extends Controller
{
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
