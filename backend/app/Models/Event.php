<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Event extends Model
{
    use HasUuids;

    protected $fillable = [
        'machine_id',
        'event_type',
        'platform',
        'domain',
        'rule_id',
        'severity',
        'elasticsearch_id',
        'metadata',
        'occurred_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'occurred_at' => 'datetime',
    ];

    public function machine(): BelongsTo
    {
        return $this->belongsTo(Machine::class);
    }

    public function rule(): BelongsTo
    {
        return $this->belongsTo(Rule::class);
    }
}
