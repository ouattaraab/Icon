<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MonitoredDomain;
use Illuminate\Http\JsonResponse;

class DomainSyncController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $domains = MonitoredDomain::all()
            ->map(fn (MonitoredDomain $d) => [
                'domain' => $d->domain,
                'platform_name' => $d->platform_name,
                'is_blocked' => (bool) $d->is_blocked,
            ]);

        return response()->json([
            'domains' => $domains,
        ]);
    }
}
