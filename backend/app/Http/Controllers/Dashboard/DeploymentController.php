<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\AgentDeployment;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DeploymentController extends Controller
{
    public function index(Request $request): Response
    {
        $deployments = AgentDeployment::query()
            ->with('machine:id,hostname,os')
            ->when($request->query('status'), fn ($q, $status) => $q->where('status', $status))
            ->when($request->query('version'), fn ($q, $version) => $q->where('version', $version))
            ->when($request->query('method'), fn ($q, $method) => $q->where('deployment_method', $method))
            ->when($request->query('date_from'), fn ($q, $from) => $q->where('deployed_at', '>=', $from)
            )
            ->when($request->query('date_to'), fn ($q, $to) => $q->where('deployed_at', '<=', $to . ' 23:59:59')
            )
            ->when($request->query('search'), fn ($q, $search) => $q->whereHas('machine', fn ($mq) => $mq->where('hostname', 'ilike', "%{$search}%"))
            )
            ->orderByDesc('deployed_at')
            ->paginate(25)
            ->through(fn (AgentDeployment $d) => [
                'id' => $d->id,
                'machine_id' => $d->machine_id,
                'hostname' => $d->machine?->hostname,
                'os' => $d->machine?->os,
                'version' => $d->version,
                'previous_version' => $d->previous_version,
                'status' => $d->status,
                'deployment_method' => $d->deployment_method,
                'error_message' => $d->error_message,
                'deployed_at' => $d->deployed_at?->toIso8601String(),
                'deployed_at_human' => $d->deployed_at?->diffForHumans(),
            ]);

        // Available versions for filter dropdown
        $versions = AgentDeployment::select('version')
            ->distinct()
            ->orderByDesc('version')
            ->pluck('version');

        return Inertia::render('Deployments/Index', [
            'deployments' => $deployments,
            'filters' => $request->only(['status', 'version', 'method', 'date_from', 'date_to', 'search']),
            'versions' => $versions,
        ]);
    }
}
