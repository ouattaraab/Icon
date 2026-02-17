<?php

use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Broadcast Channels
|--------------------------------------------------------------------------
|
| Icon WebSocket channels for real-time communication.
| Public channels are used since agents authenticate via API key,
| not via Laravel session.
|
*/

// Rules channel — agents listen for rule updates
// This is a public channel; agents connect via their own WebSocket client
Broadcast::channel('icon.rules', fn () => true);

// Dashboard channel — admin UI receives real-time updates
Broadcast::channel('icon.dashboard', fn ($user) => $user !== null);

// Per-machine channel — targeted commands from server to a specific agent
Broadcast::channel('icon.machine.{machineId}', fn ($user) => $user !== null);
