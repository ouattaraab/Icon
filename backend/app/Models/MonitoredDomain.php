<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class MonitoredDomain extends Model
{
    use HasUuids;

    protected $fillable = [
        'domain',
        'platform_name',
        'is_blocked',
    ];

    protected $casts = [
        'is_blocked' => 'boolean',
    ];
}
