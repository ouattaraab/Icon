<?php

namespace Database\Seeders;

use App\Models\Rule;
use App\Services\DlpPatternService;
use Illuminate\Database\Seeder;

class DefaultRuleSeeder extends Seeder
{
    public function run(): void
    {
        $dlp = new DlpPatternService();
        $defaultRules = $dlp->toDefaultRules();

        foreach ($defaultRules as $ruleData) {
            Rule::firstOrCreate(
                ['name' => $ruleData['name']],
                $ruleData,
            );
        }

        // Additional manual rules

        // Block prompts exceeding 10,000 characters (potential document paste)
        Rule::firstOrCreate(
            ['name' => 'Prompt trop long'],
            [
                'name' => 'Prompt trop long',
                'description' => 'Bloque les prompts de plus de 10 000 caractères qui pourraient contenir des documents internes copiés-collés.',
                'category' => 'alert',
                'target' => 'prompt',
                'condition_type' => 'content_length',
                'condition_value' => ['max_length' => 10000],
                'action_config' => [
                    'type' => 'alert',
                    'severity' => 'warning',
                ],
                'priority' => 30,
                'enabled' => true,
            ],
        );

        // Alert on clipboard content pasted into AI platforms
        Rule::firstOrCreate(
            ['name' => 'Presse-papier sensible'],
            [
                'name' => 'Presse-papier sensible',
                'description' => 'Alerte lorsque du contenu sensible est détecté dans le presse-papier pendant l\'utilisation d\'une plateforme IA.',
                'category' => 'alert',
                'target' => 'clipboard',
                'condition_type' => 'regex',
                'condition_value' => [
                    'pattern' => '(?:mot de passe|password|mdp|confidentiel|secret|IBAN|RIB)',
                    'case_insensitive' => true,
                ],
                'action_config' => [
                    'type' => 'alert',
                    'severity' => 'warning',
                ],
                'priority' => 40,
                'enabled' => true,
            ],
        );
    }
}
