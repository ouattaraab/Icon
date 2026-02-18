<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AgentDeployment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AgentDeploymentController extends Controller
{
    public function report(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'version' => 'required|string|max:50',
            'previous_version' => 'nullable|string|max:50',
            'status' => 'required|string|in:success,failed,pending,rolled_back',
            'deployment_method' => 'nullable|string|in:auto_update,manual,gpo,mdm',
            'error_message' => 'nullable|string|max:5000',
            'deployed_at' => 'nullable|date',
        ]);

        $machine = $request->get('authenticated_machine');

        $deployment = AgentDeployment::create([
            'machine_id' => $machine->id,
            'version' => $validated['version'],
            'previous_version' => $validated['previous_version'] ?? null,
            'status' => $validated['status'],
            'deployment_method' => $validated['deployment_method'] ?? null,
            'error_message' => $validated['error_message'] ?? null,
            'deployed_at' => $validated['deployed_at'] ?? now(),
        ]);

        // Update machine agent_version on successful deployment
        if ($validated['status'] === 'success') {
            $machine->update(['agent_version' => $validated['version']]);
        }

        return response()->json([
            'id' => $deployment->id,
            'received' => true,
        ], 201);
    }
}
