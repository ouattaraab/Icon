<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Machine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AgentRegistrationController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        // Validate enrollment key if configured
        $enrollmentKey = config('icon.agent.registration_key');
        if ($enrollmentKey) {
            $provided = $request->header('X-Enrollment-Key');
            if (! $provided || ! hash_equals($enrollmentKey, $provided)) {
                return response()->json(['error' => 'Invalid enrollment key'], 403);
            }
        }

        $validated = $request->validate([
            'hostname' => 'required|string|max:255',
            'os' => 'required|string|in:windows,macos',
            'os_version' => 'nullable|string|max:100',
            'agent_version' => 'required|string|max:50',
        ]);

        // Generate unique API key and HMAC secret
        $apiKey = Str::random(64);
        $hmacSecret = Str::random(64);

        $machine = Machine::create([
            'hostname' => $validated['hostname'],
            'os' => $validated['os'],
            'os_version' => $validated['os_version'] ?? null,
            'agent_version' => $validated['agent_version'],
            'api_key_hash' => Hash::make($apiKey),
            'api_key_prefix' => substr($apiKey, 0, 16),
            'hmac_secret_encrypted' => Crypt::encryptString($hmacSecret),
            'status' => 'active',
            'last_heartbeat' => now(),
            'ip_address' => $request->ip(),
        ]);

        AuditLog::log('machine.registered', 'Machine', $machine->id, [
            'hostname' => $machine->hostname,
            'os' => $machine->os,
            'ip' => $request->ip(),
        ]);

        return response()->json([
            'machine_id' => $machine->id,
            'api_key' => $apiKey,
            'hmac_secret' => $hmacSecret,
        ], 201);
    }
}
