<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::firstOrCreate(
            ['email' => 'admin@gs2e.ci'],
            [
                'name' => 'Administrateur GS2E',
                'password' => Hash::make('changeme'),
                'role' => 'admin',
            ]
        );

        if ($user->wasRecentlyCreated) {
            $this->command->warn('⚠  Le compte admin (admin@gs2e.ci) a été créé avec le mot de passe par défaut "changeme".');
            $this->command->warn('⚠  Vous DEVEZ changer ce mot de passe immédiatement après la première connexion !');
        } else {
            $this->command->info('Le compte admin (admin@gs2e.ci) existe déjà, aucune modification effectuée.');
        }
    }
}
