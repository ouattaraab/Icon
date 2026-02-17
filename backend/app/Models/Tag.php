<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Tag extends Model
{
    use HasUuids;

    protected $fillable = ['name', 'color'];

    public function machines(): BelongsToMany
    {
        return $this->belongsToMany(Machine::class);
    }
}
