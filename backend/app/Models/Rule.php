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
     * Format the rule for agent sync (matches the Rust Rule struct)
     */
    public function toAgentFormat(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'version' => $this->version,
            'category' => $this->category,
            'target' => $this->target,
            'condition' => array_merge(
                ['type' => $this->condition_type],
                $this->condition_value,
            ),
            'action' => $this->action_config ?? ['type' => 'log'],
            'priority' => $this->priority,
            'enabled' => $this->enabled,
        ];
    }
}
