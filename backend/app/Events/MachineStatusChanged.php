<?php

namespace App\Events;

use App\Models\Machine;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcast when a machine comes online, goes offline, or changes status.
 * Dashboard receives real-time machine status updates.
 */
class MachineStatusChanged implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Machine $machine,
        public string $previousStatus,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new Channel(config('icon.websocket.dashboard_channel', 'icon.dashboard')),
        ];
    }

    public function broadcastAs(): string
    {
        return 'machine.status_changed';
    }

    public function broadcastWith(): array
    {
        return [
            'machine_id' => $this->machine->id,
            'hostname' => $this->machine->hostname,
            'previous_status' => $this->previousStatus,
            'new_status' => $this->machine->status,
            'timestamp' => now()->toIso8601String(),
        ];
    }
}
