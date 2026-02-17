<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Machine extends Model
{
    use HasUuids;

    protected $fillable = [
        'hostname',
        'os',
        'os_version',
        'agent_version',
        'api_key_hash',
        'api_key_prefix',
        'hmac_secret_encrypted',
        'status',
        'last_heartbeat',
        'ip_address',
        'department',
        'assigned_user',
    ];

    protected $hidden = [
        'api_key_hash',
        'api_key_prefix',
        'hmac_secret_encrypted',
    ];

    protected $casts = [
        'last_heartbeat' => 'datetime',
    ];

    public function events(): HasMany
    {
        return $this->hasMany(Event::class);
    }

    public function alerts(): HasMany
    {
        return $this->hasMany(Alert::class);
    }

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class);
    }

    public function isOnline(): bool
    {
        return $this->last_heartbeat
            && $this->last_heartbeat->isAfter(now()->subMinutes(5));
    }
}
