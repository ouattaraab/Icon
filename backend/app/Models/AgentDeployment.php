<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AgentDeployment extends Model
{
    use HasUuids;

    protected $fillable = [
        'machine_id',
        'version',
        'previous_version',
        'status',
        'deployment_method',
        'error_message',
        'deployed_at',
    ];

    protected $casts = [
        'deployed_at' => 'datetime',
    ];

    public function machine(): BelongsTo
    {
        return $this->belongsTo(Machine::class);
    }

    public function scopeSuccessful(Builder $query): Builder
    {
        return $query->where('status', 'success');
    }

    public function scopeFailed(Builder $query): Builder
    {
        return $query->where('status', 'failed');
    }

    public function scopeRecent(Builder $query, int $days = 7): Builder
    {
        return $query->where('deployed_at', '>=', now()->subDays($days));
    }
}
