<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcast after a batch of events is processed.
 * Dashboard receives real-time activity updates.
 */
class EventsIngested implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public string $machineId,
        public string $hostname,
        public int $count,
        public int $alertsCreated,
        public ?string $platform,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new Channel(config('icon.websocket.dashboard_channel', 'icon.dashboard')),
        ];
    }

    public function broadcastAs(): string
    {
        return 'events.ingested';
    }

    public function broadcastWith(): array
    {
        return [
            'machine_id' => $this->machineId,
            'hostname' => $this->hostname,
            'count' => $this->count,
            'alerts_created' => $this->alertsCreated,
            'platform' => $this->platform,
            'timestamp' => now()->toIso8601String(),
        ];
    }
}
