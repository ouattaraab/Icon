<?php

namespace App\Http\Middleware;

use App\Models\Machine;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Response;

class ValidateAgentApiKey
{
    public function handle(Request $request, Closure $next): Response
    {
        $apiKey = $request->header('X-Api-Key');

        if (! $apiKey || strlen($apiKey) < 16) {
            return response()->json(['error' => 'Missing API key'], 401);
        }

        $prefix = substr($apiKey, 0, 16);

        // O(1) lookup by prefix, then verify full hash
        $machine = Cache::remember(
            "agent_key:{$prefix}",
            300, // 5 min cache
            fn () => Machine::where('api_key_prefix', $prefix)
                ->where('status', '!=', 'disabled')
                ->first()
        );

        if (! $machine || ! Hash::check($apiKey, $machine->api_key_hash)) {
            // Clear cache on mismatch (key may have been rotated)
            Cache::forget("agent_key:{$prefix}");

            return response()->json(['error' => 'Invalid API key'], 401);
        }

        // Attach machine to request for downstream use
        $request->merge(['authenticated_machine' => $machine]);

        return $next($request);
    }
}
