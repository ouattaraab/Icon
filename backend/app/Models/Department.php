<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Department extends Model
{
    use HasUuids;

    protected $fillable = [
        'name',
        'description',
        'manager_name',
        'machine_count',
    ];

    protected $casts = [
        'machine_count' => 'integer',
    ];

    public function machines(): HasMany
    {
        return $this->hasMany(Machine::class);
    }

    /**
     * Recompute and persist the cached machine_count.
     */
    public function updateMachineCount(): void
    {
        $this->update(['machine_count' => $this->machines()->count()]);
    }
}
