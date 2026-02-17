<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
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

        return Inertia::render('Exchanges/Index', [
            'exchanges' => $results['hits'],
            'total' => $results['total'],
            'page' => $page,
            'perPage' => $perPage,
            'filters' => array_merge(['q' => $query], $filters),
        ]);
    }

    public function show(string $id): Response
    {
        $exchange = $this->elasticsearch->getExchange($id);

        if (!$exchange) {
            abort(404);
        }

        return Inertia::render('Exchanges/Show', [
            'exchange' => array_merge($exchange, ['id' => $id]),
        ]);
    }
}
