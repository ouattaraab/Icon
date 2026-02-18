<?php

use App\Http\Controllers\Api\AgentDeploymentController;
use App\Http\Controllers\Api\AgentRegistrationController;
use App\Http\Controllers\Api\AgentUpdateController;
use App\Http\Controllers\Api\DomainSyncController;
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
Route::post('/agents/register', [AgentRegistrationController::class, 'register'])
    ->middleware('throttle:agent-registration');

// Authenticated agent routes
Route::middleware([ValidateAgentApiKey::class, VerifyHmacSignature::class])->group(function () {
    // Heartbeat — 5 requests/minute per machine
    Route::post('/agents/heartbeat', HeartbeatController::class)
        ->middleware('throttle:heartbeat');

    // Event ingestion (batch) — 30 requests/minute per machine
    Route::post('/events', EventIngestionController::class)
        ->middleware('throttle:event-ingestion');

    // Rule sync (incremental) — 10 requests/minute per machine
    Route::get('/rules/sync', RuleSyncController::class)
        ->middleware('throttle:sync');

    // Agent update check — 5 requests/minute per machine
    Route::get('/agents/update', AgentUpdateController::class)
        ->middleware('throttle:agent-update');

    // Watchdog alerts — 10 requests/minute per machine
    Route::post('/agents/watchdog-alert', WatchdogAlertController::class)
        ->middleware('throttle:watchdog-alerts');

    // Domain sync — 10 requests/minute per machine
    Route::get('/domains/sync', DomainSyncController::class)
        ->middleware('throttle:sync');

    // Agent deployment reports — 10 requests/minute per machine
    Route::post('/agents/deployment', [AgentDeploymentController::class, 'report'])
        ->middleware('throttle:sync');
});
