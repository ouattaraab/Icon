<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\Machine;
use App\Models\Rule;
use App\Services\ElasticsearchService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ExchangeController extends Controller
{
    public function __construct(
        private ElasticsearchService $elasticsearch,
    ) {}

    public function index(Request $request): Response
    {
        $query = $request->query('q', '');
        $page = max(1, (int) $request->query('page', 1));
        $perPage = 20;

        $filters = array_filter([
            'platform' => $request->query('platform'),
            'machine_id' => $request->query('machine_id'),
            'severity' => $request->query('severity'),
            'date_from' => $request->query('date_from'),
            'date_to' => $request->query('date_to'),
        ]);

        $results = $this->elasticsearch->searchExchanges(
            query: $query,
            filters: $filters,
            from: ($page - 1) * $perPage,
            size: $perPage,
        );

        // Resolve machine hostnames for display
        $machineIds = array_unique(array_filter(array_column($results['hits'], 'machine_id')));
        $machineNames = [];
        if (!empty($machineIds)) {
            $machineNames = Machine::whereIn('id', $machineIds)
                ->pluck('hostname', 'id')
                ->toArray();
        }

        $exchanges = array_map(function ($hit) use ($machineNames) {
            $hit['machine_hostname'] = $machineNames[$hit['machine_id'] ?? ''] ?? null;
            return $hit;
        }, $results['hits']);

        // Machine list for filter dropdown
        $machines = Machine::orderBy('hostname')
            ->select('id', 'hostname')
            ->get()
            ->map(fn ($m) => ['id' => $m->id, 'hostname' => $m->hostname]);

        $totalPages = max(1, (int) ceil($results['total'] / $perPage));

        return Inertia::render('Exchanges/Index', [
            'exchanges' => $exchanges,
            'total' => $results['total'],
            'page' => $page,
            'perPage' => $perPage,
            'totalPages' => $totalPages,
            'filters' => array_merge(['q' => $query], $filters),
            'machines' => $machines,
        ]);
    }

    public function show(string $id): Response
    {
        $exchange = $this->elasticsearch->getExchange($id);

        if (!$exchange) {
            abort(404);
        }

        // Resolve machine hostname
        $machine = null;
        if (!empty($exchange['machine_id'])) {
            $machine = Machine::select('id', 'hostname', 'os', 'os_version', 'department', 'assigned_user', 'status', 'last_heartbeat')
                ->find($exchange['machine_id']);
        }

        // Find the related Event in PostgreSQL for DLP metadata
        $event = null;
        if (!empty($exchange['event_id'])) {
            $event = Event::with('rule:id,name,category')
                ->find($exchange['event_id']);
        } elseif (!empty($exchange['machine_id'])) {
            // Fallback: try to find by elasticsearch_id
            $event = Event::with('rule:id,name,category')
                ->where('elasticsearch_id', $id)
                ->first();
        }

        // Resolve matched rule names
        $matchedRuleNames = [];
        if (!empty($exchange['matched_rules'])) {
            $matchedRuleNames = Rule::whereIn('id', (array) $exchange['matched_rules'])
                ->pluck('name', 'id')
                ->toArray();
        }

        return Inertia::render('Exchanges/Show', [
            'exchange' => array_merge($exchange, ['id' => $id]),
            'machine' => $machine,
            'event' => $event ? [
                'id' => $event->id,
                'severity' => $event->severity,
                'metadata' => $event->metadata,
                'rule_name' => $event->rule?->name,
                'rule_category' => $event->rule?->category,
                'occurred_at' => $event->occurred_at?->toIso8601String(),
            ] : null,
            'matchedRuleNames' => $matchedRuleNames,
        ]);
    }
}
