<?php

use App\Http\Controllers\Api\AgentRegistrationController;
use App\Http\Controllers\Api\EventIngestionController;
use App\Http\Controllers\Api\HeartbeatController;
use App\Http\Controllers\Api\RuleSyncController;
use App\Http\Controllers\Api\WatchdogAlertController;
use App\Http\Middleware\ValidateAgentApiKey;
use App\Http\Middleware\VerifyHmacSignature;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Agent API Routes
|--------------------------------------------------------------------------
|
| These endpoints are consumed by the Icon agent installed on each machine.
| Registration is open; all other routes require a valid API key.
|
*/

// Health check (used by agents to detect server connectivity)
Route::get('/health', fn () => response()->json(['status' => 'ok']));

// Agent registration (no auth required — uses pre-shared enrollment key)
Route::post('/agents/register', [AgentRegistrationController::class, 'register']);

// Authenticated agent routes
Route::middleware([ValidateAgentApiKey::class, VerifyHmacSignature::class])->group(function () {
    // Heartbeat
    Route::post('/agents/heartbeat', HeartbeatController::class);

    // Event ingestion (batch) — rate limited to 30 requests/minute per machine
    Route::post('/events', EventIngestionController::class)
        ->middleware('throttle:event-ingestion');

    // Rule sync (incremental)
    Route::get('/rules/sync', RuleSyncController::class);

    // Agent update check
    Route::get('/agents/update', function () {
        // Returns 204 if no update available
        return response()->noContent();
    });

    // Watchdog alerts
    Route::post('/agents/watchdog-alert', WatchdogAlertController::class)
        ->middleware('throttle:watchdog-alerts');
});
