<?php

namespace Database\Seeders;

use App\Models\MonitoredDomain;
use Illuminate\Database\Seeder;

class MonitoredDomainSeeder extends Seeder
{
    public function run(): void
    {
        $domains = [
            // OpenAI / ChatGPT
            ['domain' => 'api.openai.com', 'platform_name' => 'ChatGPT / OpenAI', 'is_blocked' => false],
            ['domain' => 'chat.openai.com', 'platform_name' => 'ChatGPT', 'is_blocked' => false],
            ['domain' => 'chatgpt.com', 'platform_name' => 'ChatGPT', 'is_blocked' => false],

            // Anthropic / Claude
            ['domain' => 'claude.ai', 'platform_name' => 'Claude', 'is_blocked' => false],
            ['domain' => 'api.anthropic.com', 'platform_name' => 'Claude API', 'is_blocked' => false],

            // Microsoft / Copilot
            ['domain' => 'copilot.microsoft.com', 'platform_name' => 'Microsoft Copilot', 'is_blocked' => false],
            ['domain' => 'github.copilot.com', 'platform_name' => 'GitHub Copilot', 'is_blocked' => false],

            // Google / Gemini
            ['domain' => 'gemini.google.com', 'platform_name' => 'Google Gemini', 'is_blocked' => false],
            ['domain' => 'generativelanguage.googleapis.com', 'platform_name' => 'Gemini API', 'is_blocked' => false],

            // Hugging Face
            ['domain' => 'huggingface.co', 'platform_name' => 'Hugging Face', 'is_blocked' => false],
            ['domain' => 'api-inference.huggingface.co', 'platform_name' => 'Hugging Face API', 'is_blocked' => false],

            // Perplexity
            ['domain' => 'www.perplexity.ai', 'platform_name' => 'Perplexity', 'is_blocked' => false],
            ['domain' => 'api.perplexity.ai', 'platform_name' => 'Perplexity API', 'is_blocked' => false],

            // Mistral
            ['domain' => 'chat.mistral.ai', 'platform_name' => 'Mistral (Le Chat)', 'is_blocked' => false],
            ['domain' => 'api.mistral.ai', 'platform_name' => 'Mistral API', 'is_blocked' => false],
        ];

        foreach ($domains as $domain) {
            MonitoredDomain::firstOrCreate(
                ['domain' => $domain['domain']],
                $domain,
            );
        }
    }
}
