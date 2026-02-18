<?php

namespace Tests\Unit;

use App\Services\DlpPatternService;
use PHPUnit\Framework\TestCase;

class DlpPatternServiceTest extends TestCase
{
    private DlpPatternService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new DlpPatternService();
    }

    // ── scan() ────────────────────────────────────────────────────────────

    public function test_scan_returns_empty_array_for_clean_content(): void
    {
        $result = $this->service->scan('Bonjour, ceci est un texte parfaitement innocent.');

        $this->assertIsArray($result);
        $this->assertEmpty($result);
    }

    public function test_scan_returns_empty_array_for_empty_string(): void
    {
        $result = $this->service->scan('');

        $this->assertIsArray($result);
        $this->assertEmpty($result);
    }

    public function test_scan_detects_credentials_password(): void
    {
        $result = $this->service->scan('Voici le password: secret123');

        $this->assertArrayHasKey('credentials', $result);
        $this->assertEquals('critical', $result['credentials']['severity']);
        $this->assertEquals('Identifiants / mots de passe', $result['credentials']['label']);
        $this->assertNotEmpty($result['credentials']['matches']);
        $this->assertGreaterThanOrEqual(1, $result['credentials']['count']);
    }

    public function test_scan_detects_credentials_mot_de_passe(): void
    {
        $result = $this->service->scan('mot de passe = monSuperMotDePasse');

        $this->assertArrayHasKey('credentials', $result);
        $this->assertEquals('critical', $result['credentials']['severity']);
    }

    public function test_scan_detects_credentials_api_key(): void
    {
        $result = $this->service->scan('api_key=ABCDEFGHIJKLMNOP1234567890abcdef');

        $this->assertArrayHasKey('credentials', $result);
        $this->assertEquals('critical', $result['credentials']['severity']);
    }

    public function test_scan_detects_credentials_bearer_token(): void
    {
        $result = $this->service->scan('Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test');

        $this->assertArrayHasKey('credentials', $result);
        $this->assertEquals('critical', $result['credentials']['severity']);
    }

    public function test_scan_detects_credentials_private_key(): void
    {
        $result = $this->service->scan('-----BEGIN RSA PRIVATE KEY-----');

        $this->assertArrayHasKey('credentials', $result);
        $this->assertEquals('critical', $result['credentials']['severity']);
    }

    public function test_scan_detects_credentials_openai_key(): void
    {
        $result = $this->service->scan('sk-abcdefghijklmnopqrstuvwxyz1234');

        $this->assertArrayHasKey('credentials', $result);
        $this->assertEquals('critical', $result['credentials']['severity']);
    }

    public function test_scan_detects_credentials_github_token(): void
    {
        $result = $this->service->scan('ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij');

        $this->assertArrayHasKey('credentials', $result);
        $this->assertEquals('critical', $result['credentials']['severity']);
    }

    public function test_scan_detects_financial_iban(): void
    {
        $result = $this->service->scan('Mon IBAN est FR76 1234 5678 9012 3456 7890 123');

        $this->assertArrayHasKey('financial', $result);
        $this->assertEquals('critical', $result['financial']['severity']);
        $this->assertEquals('Données financières', $result['financial']['label']);
        $this->assertNotEmpty($result['financial']['matches']);
    }

    public function test_scan_detects_financial_credit_card(): void
    {
        $result = $this->service->scan('Carte bancaire: 4111 1111 1111 1111');

        $this->assertArrayHasKey('financial', $result);
        $this->assertEquals('critical', $result['financial']['severity']);
    }

    public function test_scan_detects_financial_rib(): void
    {
        $result = $this->service->scan('RIB: 12345 67890 12345678901 23');

        $this->assertArrayHasKey('financial', $result);
        $this->assertEquals('critical', $result['financial']['severity']);
    }

    public function test_scan_detects_gs2e_internal_reference(): void
    {
        $result = $this->service->scan('Le projet GS2E-1234 est en cours.');

        $this->assertArrayHasKey('gs2e_internal', $result);
        $this->assertEquals('critical', $result['gs2e_internal']['severity']);
        $this->assertEquals('Données internes GS2E', $result['gs2e_internal']['label']);
        $this->assertNotEmpty($result['gs2e_internal']['matches']);
    }

    public function test_scan_detects_gs2e_project_reference(): void
    {
        $result = $this->service->scan('Voir la référence PRJ-5678 pour les détails.');

        $this->assertArrayHasKey('gs2e_internal', $result);
        $this->assertEquals('critical', $result['gs2e_internal']['severity']);
    }

    public function test_scan_detects_gs2e_contract_number(): void
    {
        $result = $this->service->scan('Contrat CTR-9876 signé hier.');

        $this->assertArrayHasKey('gs2e_internal', $result);
        $this->assertEquals('critical', $result['gs2e_internal']['severity']);
    }

    public function test_scan_detects_personal_data_french_phone(): void
    {
        $result = $this->service->scan('Appelez-moi au 06 12 34 56 78 pour en discuter.');

        $this->assertArrayHasKey('personal_data', $result);
        $this->assertEquals('warning', $result['personal_data']['severity']);
        $this->assertEquals('Données personnelles', $result['personal_data']['label']);
        $this->assertNotEmpty($result['personal_data']['matches']);
    }

    public function test_scan_detects_personal_data_ivorian_phone(): void
    {
        $result = $this->service->scan('Contactez-moi au 0022507123456');

        $this->assertArrayHasKey('personal_data', $result);
        $this->assertEquals('warning', $result['personal_data']['severity']);
    }

    public function test_scan_detects_personal_data_gs2e_email(): void
    {
        $result = $this->service->scan('Envoyez un mail à john.doe@gs2e.ci pour info.');

        $this->assertArrayHasKey('personal_data', $result);
        $this->assertEquals('warning', $result['personal_data']['severity']);
    }

    public function test_scan_detects_source_code_php_class(): void
    {
        $content = <<<'CODE'
<?php
class UserController extends Controller
{
    public function index() {}
}
CODE;

        $result = $this->service->scan($content);

        $this->assertArrayHasKey('source_code', $result);
        $this->assertEquals('warning', $result['source_code']['severity']);
        $this->assertEquals('Code source', $result['source_code']['label']);
    }

    public function test_scan_detects_source_code_python_function(): void
    {
        $content = <<<'CODE'
def process_data(input_data: list) -> dict:
    return {"result": input_data}
CODE;

        $result = $this->service->scan($content);

        $this->assertArrayHasKey('source_code', $result);
        $this->assertEquals('warning', $result['source_code']['severity']);
    }

    public function test_scan_detects_source_code_sql(): void
    {
        $content = "CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(255))";

        $result = $this->service->scan($content);

        $this->assertArrayHasKey('source_code', $result);
        $this->assertEquals('warning', $result['source_code']['severity']);
    }

    public function test_scan_detects_source_code_laravel_namespace(): void
    {
        $content = <<<'CODE'
namespace App\Models;
use App\Services\UserService;
CODE;

        $result = $this->service->scan($content);

        $this->assertArrayHasKey('source_code', $result);
        $this->assertEquals('warning', $result['source_code']['severity']);
    }

    public function test_scan_detects_source_code_env_file(): void
    {
        $content = '.env DB_PASSWORD=secret123';

        $result = $this->service->scan($content);

        $this->assertArrayHasKey('source_code', $result);
        $this->assertEquals('warning', $result['source_code']['severity']);
    }

    public function test_scan_detects_confidential_markers(): void
    {
        $result = $this->service->scan('Ce document est strictement confidentiel et ne doit pas être diffusé.');

        $this->assertArrayHasKey('confidential_docs', $result);
        $this->assertEquals('warning', $result['confidential_docs']['severity']);
        $this->assertEquals('Documents confidentiels', $result['confidential_docs']['label']);
        $this->assertNotEmpty($result['confidential_docs']['matches']);
    }

    public function test_scan_detects_confidential_cahier_des_charges(): void
    {
        $result = $this->service->scan('Voici le cahier des charges du projet.');

        $this->assertArrayHasKey('confidential_docs', $result);
        $this->assertEquals('warning', $result['confidential_docs']['severity']);
    }

    public function test_scan_detects_confidential_usage_interne(): void
    {
        $result = $this->service->scan('Document à usage interne uniquement.');

        $this->assertArrayHasKey('confidential_docs', $result);
        $this->assertEquals('warning', $result['confidential_docs']['severity']);
    }

    public function test_scan_detects_multiple_categories(): void
    {
        $content = 'password: secret123 et le projet GS2E-4567 est confidentiel';

        $result = $this->service->scan($content);

        $this->assertArrayHasKey('credentials', $result);
        $this->assertArrayHasKey('gs2e_internal', $result);
        $this->assertArrayHasKey('confidential_docs', $result);
    }

    public function test_scan_redacts_matched_values(): void
    {
        $result = $this->service->scan('password: verylongsecretpassword');

        $this->assertArrayHasKey('credentials', $result);
        foreach ($result['credentials']['matches'] as $match) {
            // Redacted values should contain asterisks
            $this->assertStringContainsString('*', $match);
        }
    }

    public function test_scan_deduplicates_matches(): void
    {
        $content = "password: abc123\npassword: abc123\npassword: abc123";

        $result = $this->service->scan($content);

        $this->assertArrayHasKey('credentials', $result);
        // matches should be deduplicated via array_unique
        $this->assertCount(1, $result['credentials']['matches']);
    }

    // ── hasMatch() ────────────────────────────────────────────────────────

    public function test_has_match_returns_true_for_matching_content(): void
    {
        $this->assertTrue($this->service->hasMatch('password: secret123'));
    }

    public function test_has_match_returns_true_for_iban(): void
    {
        $this->assertTrue($this->service->hasMatch('FR76 1234 5678 9012 3456 7890 123'));
    }

    public function test_has_match_returns_true_for_gs2e_reference(): void
    {
        $this->assertTrue($this->service->hasMatch('GS2E-1234'));
    }

    public function test_has_match_returns_true_for_confidential_marker(): void
    {
        $this->assertTrue($this->service->hasMatch('Ce document est confidentiel'));
    }

    public function test_has_match_returns_false_for_clean_content(): void
    {
        $this->assertFalse($this->service->hasMatch('Bonjour, comment allez-vous ?'));
    }

    public function test_has_match_returns_false_for_empty_string(): void
    {
        $this->assertFalse($this->service->hasMatch(''));
    }

    // ── highestSeverity() ────────────────────────────────────────────────

    public function test_highest_severity_returns_critical_for_critical_matches(): void
    {
        $scanResults = [
            'credentials' => [
                'label' => 'Identifiants / mots de passe',
                'severity' => 'critical',
                'matches' => ['pas*****123'],
                'count' => 1,
            ],
            'personal_data' => [
                'label' => 'Données personnelles',
                'severity' => 'warning',
                'matches' => ['06 *****78'],
                'count' => 1,
            ],
        ];

        $this->assertEquals('critical', $this->service->highestSeverity($scanResults));
    }

    public function test_highest_severity_returns_critical_when_only_critical(): void
    {
        $scanResults = [
            'financial' => [
                'label' => 'Données financières',
                'severity' => 'critical',
                'matches' => ['FR7*********123'],
                'count' => 1,
            ],
        ];

        $this->assertEquals('critical', $this->service->highestSeverity($scanResults));
    }

    public function test_highest_severity_returns_warning_for_warning_only(): void
    {
        $scanResults = [
            'personal_data' => [
                'label' => 'Données personnelles',
                'severity' => 'warning',
                'matches' => ['06 *****78'],
                'count' => 1,
            ],
            'source_code' => [
                'label' => 'Code source',
                'severity' => 'warning',
                'matches' => ['cla***end'],
                'count' => 1,
            ],
        ];

        $this->assertEquals('warning', $this->service->highestSeverity($scanResults));
    }

    public function test_highest_severity_returns_warning_for_empty_results(): void
    {
        $this->assertEquals('warning', $this->service->highestSeverity([]));
    }

    // ── toDefaultRules() ────────────────────────────────────────────────

    public function test_to_default_rules_returns_array(): void
    {
        $rules = $this->service->toDefaultRules();

        $this->assertIsArray($rules);
        $this->assertNotEmpty($rules);
    }

    public function test_to_default_rules_has_correct_structure(): void
    {
        $rules = $this->service->toDefaultRules();

        foreach ($rules as $rule) {
            $this->assertArrayHasKey('name', $rule);
            $this->assertArrayHasKey('description', $rule);
            $this->assertArrayHasKey('category', $rule);
            $this->assertArrayHasKey('target', $rule);
            $this->assertArrayHasKey('condition_type', $rule);
            $this->assertArrayHasKey('condition_value', $rule);
            $this->assertArrayHasKey('action_config', $rule);
            $this->assertArrayHasKey('priority', $rule);
            $this->assertArrayHasKey('enabled', $rule);

            // Validate condition_value structure
            $this->assertArrayHasKey('pattern', $rule['condition_value']);
            $this->assertArrayHasKey('case_insensitive', $rule['condition_value']);
            $this->assertIsString($rule['condition_value']['pattern']);
            $this->assertIsBool($rule['condition_value']['case_insensitive']);

            // Validate condition_type is always 'regex'
            $this->assertEquals('regex', $rule['condition_type']);

            // Validate target is always 'prompt'
            $this->assertEquals('prompt', $rule['target']);

            // Validate enabled is always true
            $this->assertTrue($rule['enabled']);

            // Validate category is either 'block' or 'alert'
            $this->assertContains($rule['category'], ['block', 'alert']);

            // Validate action_config has a type
            $this->assertArrayHasKey('type', $rule['action_config']);
            $this->assertContains($rule['action_config']['type'], ['block', 'alert']);
        }
    }

    public function test_to_default_rules_critical_patterns_produce_block_rules(): void
    {
        $rules = $this->service->toDefaultRules();

        // Find rules generated from critical categories (credentials, financial, gs2e_internal)
        $blockRules = array_filter($rules, fn ($r) => $r['category'] === 'block');

        $this->assertNotEmpty($blockRules);

        foreach ($blockRules as $rule) {
            $this->assertEquals('block', $rule['action_config']['type']);
            $this->assertArrayHasKey('message', $rule['action_config']);
        }
    }

    public function test_to_default_rules_warning_patterns_produce_alert_rules(): void
    {
        $rules = $this->service->toDefaultRules();

        // Find rules generated from warning categories (personal_data, source_code, confidential_docs)
        $alertRules = array_filter($rules, fn ($r) => $r['category'] === 'alert');

        $this->assertNotEmpty($alertRules);

        foreach ($alertRules as $rule) {
            $this->assertEquals('alert', $rule['action_config']['type']);
            $this->assertArrayHasKey('severity', $rule['action_config']);
        }
    }

    public function test_to_default_rules_priorities_are_descending(): void
    {
        $rules = $this->service->toDefaultRules();

        $priorities = array_column($rules, 'priority');

        // Each successive priority should be less than or equal to the previous one
        for ($i = 1; $i < count($priorities); $i++) {
            $this->assertLessThanOrEqual(
                $priorities[$i - 1],
                $priorities[$i],
                'Rule priorities should be in descending order'
            );
        }
    }

    public function test_to_default_rules_patterns_are_valid_rust_regex(): void
    {
        $rules = $this->service->toDefaultRules();

        foreach ($rules as $rule) {
            $pattern = $rule['condition_value']['pattern'];

            // Rust regex patterns should not have PHP delimiters
            $this->assertFalse(
                str_starts_with($pattern, '/'),
                "Pattern should not start with PHP delimiter: $pattern"
            );
        }
    }
}
