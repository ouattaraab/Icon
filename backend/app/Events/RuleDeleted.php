<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcast when a rule is deleted.
 * Agents must remove the rule from their local cache.
 */
class RuleDeleted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public string $ruleId,
        public string $ruleName,
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
        return 'rule.deleted';
    }

    public function broadcastWith(): array
    {
        return [
            'action' => 'deleted',
            'rule_id' => $this->ruleId,
            'rule_name' => $this->ruleName,
            'timestamp' => now()->toIso8601String(),
        ];
    }
}
