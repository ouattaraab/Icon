<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessEventBatch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EventIngestionController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'machine_id' => 'required|uuid',
            'events' => 'required|array|max:100',
            'events.*.event_type' => 'required|string|max:50',
            'events.*.platform' => 'nullable|string|max:100',
            'events.*.domain' => 'nullable|string|max:255',
            'events.*.content_hash' => 'nullable|string|max:64',
            'events.*.prompt_excerpt' => 'nullable|string|max:5000',
            'events.*.response_excerpt' => 'nullable|string|max:5000',
            'events.*.rule_id' => 'nullable|uuid',
            'events.*.severity' => 'nullable|string|max:20',
            'events.*.metadata' => 'nullable|string',
            'events.*.occurred_at' => 'required|date',
        ]);

        $machine = $request->get('authenticated_machine');

        // Dispatch async processing to avoid blocking the agent
        ProcessEventBatch::dispatch(
            $machine->id,
            $validated['events']
        );

        return response()->json([
            'accepted' => count($validated['events']),
        ], 202);
    }
}
