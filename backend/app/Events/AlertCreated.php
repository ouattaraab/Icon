<?php

namespace App\Events;

use App\Models\Alert;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcast when a new alert is created.
 * Dashboard receives real-time alert notifications.
 */
class AlertCreated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Alert $alert,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new Channel(config('icon.websocket.dashboard_channel', 'icon.dashboard')),
        ];
    }

    public function broadcastAs(): string
    {
        return 'alert.created';
    }

    public function broadcastWith(): array
    {
        return [
            'id' => $this->alert->id,
            'severity' => $this->alert->severity,
            'title' => $this->alert->title,
            'machine' => $this->alert->machine?->hostname,
            'rule' => $this->alert->rule?->name,
            'created_at' => $this->alert->created_at?->toIso8601String(),
        ];
    }
}
