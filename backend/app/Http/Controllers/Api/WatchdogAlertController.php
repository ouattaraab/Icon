<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Alert;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Receives alerts from the watchdog process running on agent machines.
 * These alerts indicate potential tampering, crashes, or proxy bypass attempts.
 */
class WatchdogAlertController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'alert_type' => 'required|string|max:100',
            'message' => 'required|string|max:2000',
            'source' => 'required|string|max:50',
            'agent_version' => 'nullable|string|max:50',
        ]);

        $machine = $request->get('authenticated_machine');

        $severity = $this->alertTypeSeverity($validated['alert_type']);

        Log::warning("Watchdog alert from {$machine->hostname}", $validated);

        Alert::create([
            'machine_id' => $machine->id,
            'severity' => $severity,
            'title' => $this->formatTitle($validated['alert_type'], $machine->hostname),
            'description' => $validated['message'],
            'status' => 'open',
        ]);

        return response()->json(['received' => true]);
    }

    private function alertTypeSeverity(string $type): string
    {
        return match ($type) {
            'binary_tampered', 'agent_crash_loop' => 'critical',
            'proxy_tampered', 'agent_restarted' => 'warning',
            default => 'warning',
        };
    }

    private function formatTitle(string $type, string $hostname): string
    {
        return match ($type) {
            'agent_restarted' => "Agent redémarré automatiquement sur {$hostname}",
            'agent_crash_loop' => "Agent en boucle de crash sur {$hostname}",
            'proxy_tampered' => "Configuration proxy modifiée sur {$hostname}",
            'binary_tampered' => "Intégrité du binaire agent compromise sur {$hostname}",
            default => "Alerte watchdog [{$type}] sur {$hostname}",
        };
    }
}
