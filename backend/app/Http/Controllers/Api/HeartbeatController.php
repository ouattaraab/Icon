<?php

namespace App\Http\Controllers\Api;

use App\Events\MachineStatusChanged;
use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HeartbeatController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'machine_id' => 'required|uuid',
            'status' => 'required|string',
            'agent_version' => 'required|string',
            'queue_size' => 'required|integer',
            'uptime_secs' => 'required|integer',
        ]);

        $machine = $request->get('authenticated_machine');

        $previousStatus = $machine->status;

        $machine->update([
            'last_heartbeat' => now(),
            'agent_version' => $validated['agent_version'],
            'status' => 'active',
            'ip_address' => $request->ip(),
        ]);

        // Notify dashboard if machine just came online
        if ($previousStatus !== 'active') {
            broadcast(new MachineStatusChanged($machine, $previousStatus));
        }

        // Check if we need to force a rule sync
        $latestRuleVersion = \App\Models\Rule::max('version') ?? 0;
        $forceSyncRules = false; // Could be triggered by admin action via Redis flag

        // Check for available updates (from admin settings)
        $currentAgentVersion = Setting::getValue('agent_current_version', config('icon.agent.current_version', '0.1.0'));
        $updateAvailable = null;
        if ($currentAgentVersion && version_compare($validated['agent_version'], $currentAgentVersion, '<')) {
            $updateAvailable = [
                'version' => $currentAgentVersion,
                'download_url' => Setting::getValue('agent_update_url', config('icon.agent.update_url', '')),
                'verify_signature' => Setting::getValue('verify_signatures', '1') === '1',
            ];
        }

        return response()->json([
            'force_sync_rules' => $forceSyncRules,
            'update_available' => $updateAvailable,
        ]);
    }
}
