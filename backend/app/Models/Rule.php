<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Rule extends Model
{
    use HasUuids;

    protected $fillable = [
        'name',
        'description',
        'category',
        'target',
        'condition_type',
        'condition_value',
        'action_config',
        'priority',
        'enabled',
        'version',
        'created_by',
    ];

    protected $casts = [
        'condition_value' => 'array',
        'action_config' => 'array',
        'enabled' => 'boolean',
        'version' => 'integer',
        'priority' => 'integer',
    ];

    protected static function booted(): void
    {
        static::saving(function (Rule $rule) {
            $rule->version = ($rule->version ?? 0) + 1;
        });
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopeEnabled($query)
    {
        return $query->where('enabled', true);
    }

    public function scopeCategory($query, string $category)
    {
        return $query->where('category', $category);
    }

    /**
     * Format the rule for agent sync (matches the Rust Rule struct).
     *
     * The Rust agent expects:
     * - condition.keywords as Vec<String> (not comma-separated)
     * - condition.domains as Vec<String> (not newline-separated)
     * - condition.max/min (not max_length)
     */
    public function toAgentFormat(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'version' => $this->version,
            'category' => $this->category,
            'target' => $this->target,
            'condition' => $this->buildAgentCondition(),
            'action' => $this->action_config ?? ['type' => 'log'],
            'priority' => $this->priority,
            'enabled' => $this->enabled,
        ];
    }

    private function buildAgentCondition(): array
    {
        $base = ['type' => $this->condition_type];
        $value = $this->condition_value;

        return match ($this->condition_type) {
            'keyword' => array_merge($base, [
                'keywords' => is_array($value['keywords'] ?? null)
                    ? $value['keywords']
                    : array_values(array_filter(array_map('trim', explode(',', $value['keywords'] ?? '')))),
                'match_all' => (bool) ($value['match_all'] ?? false),
            ]),
            'domain_list' => array_merge($base, [
                'domains' => is_array($value['domains'] ?? null)
                    ? $value['domains']
                    : array_values(array_filter(array_map('trim', preg_split('/[\n,]+/', $value['domains'] ?? '')))),
            ]),
            'content_length' => array_merge($base, [
                'min' => isset($value['min_length']) ? (int) $value['min_length'] : ($value['min'] ?? null),
                'max' => isset($value['max_length']) ? (int) $value['max_length'] : ($value['max'] ?? null),
            ]),
            default => array_merge($base, $value),
        };
    }
}
