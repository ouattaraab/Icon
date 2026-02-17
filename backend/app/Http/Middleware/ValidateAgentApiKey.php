<?php

namespace App\Http\Middleware;

use App\Models\Machine;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Response;

class ValidateAgentApiKey
{
    public function handle(Request $request, Closure $next): Response
    {
        $apiKey = $request->header('X-Api-Key');

        if (!$apiKey) {
            return response()->json(['error' => 'Missing API key'], 401);
        }

        // Find the machine by checking API key hash
        // For performance, we cache a mapping of key prefix -> machine_id in Redis
        $machine = Machine::where('status', '!=', 'disabled')
            ->get()
            ->first(fn (Machine $m) => Hash::check($apiKey, $m->api_key_hash));

        if (!$machine) {
            return response()->json(['error' => 'Invalid API key'], 401);
        }

        // Attach machine to request for downstream use
        $request->merge(['authenticated_machine' => $machine]);

        return $next($request);
    }
}
