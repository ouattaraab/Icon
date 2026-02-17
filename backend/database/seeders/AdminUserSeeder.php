<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        User::firstOrCreate(
            ['email' => 'admin@gs2e.ci'],
            [
                'name' => 'Administrateur GS2E',
                'password' => Hash::make('changeme'),
                'role' => 'admin',
            ]
        );
    }
}
