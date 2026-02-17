<?php

namespace App\Events;

use App\Models\Rule;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcast when a rule is created, updated, or toggled.
 * Agents listen on the rules channel for real-time sync.
 * Dashboard listens for live table refresh.
 */
class RuleUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Rule $rule,
        public string $action = 'updated', // 'created', 'updated', 'deleted', 'toggled'
    ) {}

    public function broadcastOn(): array
    {
        return [
            new Channel(config('icon.websocket.rules_channel', 'icon.rules')),
            new Channel(config('icon.websocket.dashboard_channel', 'icon.dashboard')),
        ];
    }

    public function broadcastAs(): string
    {
        return 'rule.changed';
    }

    public function broadcastWith(): array
    {
        return [
            'action' => $this->action,
            'rule' => $this->rule->toAgentFormat(),
            'version' => $this->rule->version,
            'timestamp' => now()->toIso8601String(),
        ];
    }
}
