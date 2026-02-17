<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

/**
 * Data Loss Prevention pattern detection service.
 *
 * Scans text content for sensitive GS2E data patterns:
 * - Internal project codes, contract numbers
 * - Credentials, API keys, passwords
 * - Source code fragments
 * - Financial data (IBAN, RIB)
 * - Personal data (phone numbers, emails)
 * - Confidential document keywords
 */
class DlpPatternService
{
    /**
     * Built-in pattern categories with their regex patterns.
     * These are used as defaults and can be extended via rules.
     */
    private array $patterns = [
        'credentials' => [
            'label' => 'Identifiants / mots de passe',
            'severity' => 'critical',
            'patterns' => [
                '/\b(?:mot de passe|password|mdp|pwd)\s*[:=]\s*\S+/i',
                '/\b(?:api[_-]?key|apikey|secret[_-]?key|access[_-]?token)\s*[:=]\s*["\']?[A-Za-z0-9\-_.]{16,}["\']?/i',
                '/\b(?:Bearer|Basic)\s+[A-Za-z0-9\-_.~+\/]{20,}/i',
                '/-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/',
                '/\bsk-[A-Za-z0-9]{20,}\b/',  // OpenAI API keys
                '/\bghp_[A-Za-z0-9]{36}\b/',  // GitHub tokens
            ],
        ],

        'financial' => [
            'label' => 'Données financières',
            'severity' => 'critical',
            'patterns' => [
                '/\b[A-Z]{2}\d{2}[\s]?[\dA-Z]{4}[\s]?[\dA-Z]{4}[\s]?[\dA-Z]{4}[\s]?[\dA-Z]{4}[\s]?[\dA-Z]{0,4}\b/', // IBAN
                '/\bRIB\s*[:=]?\s*\d{5}\s*\d{5}\s*\d{11}\s*\d{2}\b/i', // RIB français
                '/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/', // Numéro de carte bancaire
                '/\bchiffre\s+d\'affaires?\b.*\d+/i',
                '/\b(?:montant|budget|facturation|facture)\s*[:=]?\s*\d[\d\s.,]+\s*(?:FCFA|XOF|EUR|USD|F\s*CFA)\b/i',
            ],
        ],

        'gs2e_internal' => [
            'label' => 'Données internes GS2E',
            'severity' => 'critical',
            'patterns' => [
                '/\b(?:GS2E|gs2e)[-_]?\d{4,}/i',                   // Code projet GS2E
                '/\bPRJ[-_]\d{4,}\b/i',                             // Référence projet
                '/\bCTR[-_]\d{4,}\b/i',                             // Numéro de contrat
                '/\bmarcel[\'i]?a\b.*(?:interne|confidentiel)/i',    // Marcel'IA interne
                '/\b(?:appel\s+d\'offres?|DAO)\s*(?:n[°o]?\s*)?\d+/i', // Appels d'offres
                '/\bstratégi(?:e|que)\s+(?:commerciale|digitale|numérique)\b/i',
            ],
        ],

        'personal_data' => [
            'label' => 'Données personnelles',
            'severity' => 'warning',
            'patterns' => [
                '/\b(?:\+225|00225)[\s.-]?\d{2}[\s.-]?\d{3}[\s.-]?\d{3}\b/', // Téléphone CI
                '/\b(?:\+33|0033|0)[\s.-]?[1-9](?:[\s.-]?\d{2}){4}\b/',      // Téléphone FR
                '/\b[A-Za-z0-9._%+-]+@(?:gs2e\.ci|gs2e\.com)\b/i',            // Emails GS2E
                '/\bCI\d{9}\b/',                                                // CNI Côte d'Ivoire
            ],
        ],

        'source_code' => [
            'label' => 'Code source',
            'severity' => 'warning',
            'patterns' => [
                '/(?:^|\n)\s*(?:class|interface|abstract\s+class)\s+\w+\s*(?:extends|implements)/m', // Java/PHP/TS classes
                '/(?:^|\n)\s*(?:def|async\s+def)\s+\w+\s*\([^)]*\)\s*(?:->|:)/m',                   // Python functions
                '/(?:^|\n)\s*(?:pub\s+)?(?:fn|struct|enum|impl|trait)\s+\w+/m',                       // Rust
                '/(?:^|\n)\s*(?:CREATE\s+TABLE|ALTER\s+TABLE|INSERT\s+INTO|SELECT\s+.+\s+FROM)\s/im', // SQL
                '/(?:^|\n)\s*(?:namespace|use)\s+App\\\\/m',                                          // Laravel namespaces
                '/\.env\b.*(?:DB_PASSWORD|APP_KEY|SECRET|API_KEY)\s*=/i',                              // .env files
            ],
        ],

        'confidential_docs' => [
            'label' => 'Documents confidentiels',
            'severity' => 'warning',
            'patterns' => [
                '/\b(?:confidentiel|strictement\s+confidentiel|usage\s+interne|ne\s+pas\s+diffuser)\b/i',
                '/\b(?:cahier\s+des?\s+charges?|CDC|spécifications?\s+techniques?|spécifications?\s+fonctionnelles?)\b/i',
                '/\b(?:note\s+de\s+service|procès[\s-]verbal|PV|compte[\s-]rendu\s+(?:de\s+)?réunion)\b/i',
                '/\b(?:organigramme|plan\s+stratégique|road\s*map)\b/i',
                '/\b(?:audit\s+(?:interne|sécurité)|rapport\s+d\'audit)\b/i',
            ],
        ],
    ];

    /**
     * Scan content against all DLP patterns.
     * Returns an array of matches grouped by category.
     *
     * @return array<string, array{label: string, severity: string, matches: array}>
     */
    public function scan(string $content): array
    {
        $results = [];

        foreach ($this->patterns as $category => $config) {
            $matches = [];

            foreach ($config['patterns'] as $pattern) {
                try {
                    if (preg_match_all($pattern, $content, $found)) {
                        foreach ($found[0] as $match) {
                            $matches[] = $this->redact($match);
                        }
                    }
                } catch (\Throwable $e) {
                    Log::warning("DLP pattern error in category {$category}", [
                        'pattern' => $pattern,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            if (!empty($matches)) {
                $results[$category] = [
                    'label' => $config['label'],
                    'severity' => $config['severity'],
                    'matches' => array_unique($matches),
                    'count' => count($matches),
                ];
            }
        }

        return $results;
    }

    /**
     * Quick check: does the content match any DLP pattern?
     */
    public function hasMatch(string $content): bool
    {
        foreach ($this->patterns as $config) {
            foreach ($config['patterns'] as $pattern) {
                try {
                    if (preg_match($pattern, $content)) {
                        return true;
                    }
                } catch (\Throwable) {
                    continue;
                }
            }
        }
        return false;
    }

    /**
     * Get the highest severity level from scan results.
     */
    public function highestSeverity(array $scanResults): string
    {
        $hasCritical = false;
        foreach ($scanResults as $result) {
            if ($result['severity'] === 'critical') {
                $hasCritical = true;
                break;
            }
        }
        return $hasCritical ? 'critical' : 'warning';
    }

    /**
     * Partially redact a matched value for logging (show first/last chars only).
     */
    private function redact(string $value): string
    {
        $len = mb_strlen($value);
        if ($len <= 6) {
            return str_repeat('*', $len);
        }

        $visible = min(3, (int) ($len * 0.2));
        return mb_substr($value, 0, $visible)
            . str_repeat('*', $len - $visible * 2)
            . mb_substr($value, -$visible);
    }

    /**
     * Generate default Rule records from the built-in patterns.
     * Used by the database seeder.
     *
     * @return array<array>
     */
    public function toDefaultRules(): array
    {
        $rules = [];
        $priority = 100;

        foreach ($this->patterns as $category => $config) {
            foreach ($config['patterns'] as $i => $pattern) {
                // Strip PHP regex delimiters and flags for the agent (Rust regex)
                $rustPattern = $this->phpToRustRegex($pattern);
                if ($rustPattern === null) {
                    continue;
                }

                $actionType = $config['severity'] === 'critical' ? 'block' : 'alert';

                $rules[] = [
                    'name' => "{$config['label']} #{$i}",
                    'description' => "DLP auto-généré : {$config['label']}",
                    'category' => $actionType,
                    'target' => 'prompt',
                    'condition_type' => 'regex',
                    'condition_value' => [
                        'pattern' => $rustPattern,
                        'case_insensitive' => str_contains($pattern, '/i'),
                    ],
                    'action_config' => $actionType === 'block'
                        ? [
                            'type' => 'block',
                            'message' => "Contenu sensible détecté ({$config['label']}). Utilisez Marcel'IA pour les données internes GS2E.",
                        ]
                        : [
                            'type' => 'alert',
                            'severity' => $config['severity'],
                        ],
                    'priority' => $priority--,
                    'enabled' => true,
                ];
            }
        }

        return $rules;
    }

    /**
     * Convert a PHP regex to a Rust-compatible regex string.
     * Strips delimiters and flags, translates where possible.
     */
    private function phpToRustRegex(string $phpPattern): ?string
    {
        // Strip the leading/trailing delimiter and flags
        if (preg_match('#^/(.+)/([imsxuU]*)$#s', $phpPattern, $m)) {
            return $m[1];
        }
        return null;
    }
}
