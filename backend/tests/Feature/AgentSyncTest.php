<?php

namespace Tests\Feature;

use App\Models\Machine;
use App\Models\MonitoredDomain;
use App\Models\Rule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * Tests for agent sync endpoints: rule sync format compatibility
 * with the Rust agent, and domain sync endpoint.
 */
class AgentSyncTest extends TestCase
{
    use RefreshDatabase;

    private string $hmacSecret = 'sync-test-hmac-secret';

    private string $apiKey;

    private Machine $machine;

    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();

        config([
            'icon.security.hmac_secret' => $this->hmacSecret,
            'icon.security.verify_signatures' => true,
        ]);

        $this->apiKey = 'test-sync-api-key-' . uniqid();
        $this->machine = Machine::create([
            'hostname' => 'SYNC-TEST-PC',
            'os' => 'windows',
            'os_version' => '11.0',
            'agent_version' => '0.1.0',
            'api_key_hash' => bcrypt($this->apiKey),
            'api_key_prefix' => substr($this->apiKey, 0, 16),
            'status' => 'active',
            'last_heartbeat' => now(),
            'ip_address' => '192.168.1.200',
        ]);
    }

    private function signedGet(string $url): \Illuminate\Testing\TestResponse
    {
        $signature = hash_hmac('sha256', '', $this->hmacSecret);

        return $this->getJson($url, [
            'X-Api-Key' => $this->apiKey,
            'X-Signature' => $signature,
            'X-Timestamp' => (string) time(),
        ]);
    }

    // ---------------------------------------------------------------
    // Rule Sync Format Tests
    // ---------------------------------------------------------------

    public function test_keyword_rule_returns_array_not_string(): void
    {
        Rule::create([
            'name' => 'Test Keyword Rule',
            'category' => 'alert',
            'target' => 'prompt',
            'condition_type' => 'keyword',
            'condition_value' => ['keywords' => 'password,secret,api_key'],
            'action_config' => ['type' => 'alert', 'severity' => 'warning'],
            'priority' => 50,
            'enabled' => true,
        ]);

        $response = $this->signedGet('/api/rules/sync?version=0');

        $response->assertOk();
        $rules = $response->json('rules');
        $this->assertCount(1, $rules);

        $condition = $rules[0]['condition'];
        $this->assertEquals('keyword', $condition['type']);
        // Must be an array for Rust Vec<String>, not a comma-separated string
        $this->assertIsArray($condition['keywords']);
        $this->assertEquals(['password', 'secret', 'api_key'], $condition['keywords']);
        $this->assertFalse($condition['match_all']);
    }

    public function test_keyword_rule_already_array_passes_through(): void
    {
        Rule::create([
            'name' => 'Test Keyword Array',
            'category' => 'block',
            'target' => 'prompt',
            'condition_type' => 'keyword',
            'condition_value' => ['keywords' => ['confidentiel', 'interne', 'secret'], 'match_all' => true],
            'action_config' => ['type' => 'block', 'message' => 'Blocked'],
            'priority' => 60,
            'enabled' => true,
        ]);

        $response = $this->signedGet('/api/rules/sync?version=0');

        $rules = $response->json('rules');
        $condition = $rules[0]['condition'];
        $this->assertIsArray($condition['keywords']);
        $this->assertEquals(['confidentiel', 'interne', 'secret'], $condition['keywords']);
        $this->assertTrue($condition['match_all']);
    }

    public function test_domain_list_rule_returns_array(): void
    {
        Rule::create([
            'name' => 'Test Domain List Rule',
            'category' => 'block',
            'target' => 'domain',
            'condition_type' => 'domain_list',
            'condition_value' => ['domains' => "api.openai.com\nchat.openai.com\nclaude.ai"],
            'action_config' => ['type' => 'block', 'message' => 'Blocked domain'],
            'priority' => 70,
            'enabled' => true,
        ]);

        $response = $this->signedGet('/api/rules/sync?version=0');

        $rules = $response->json('rules');
        $condition = $rules[0]['condition'];
        $this->assertEquals('domain_list', $condition['type']);
        // Must be an array for Rust Vec<String>, not a newline-separated string
        $this->assertIsArray($condition['domains']);
        $this->assertEquals(['api.openai.com', 'chat.openai.com', 'claude.ai'], $condition['domains']);
    }

    public function test_domain_list_comma_separated_returns_array(): void
    {
        Rule::create([
            'name' => 'Test Domain List Comma',
            'category' => 'block',
            'target' => 'domain',
            'condition_type' => 'domain_list',
            'condition_value' => ['domains' => 'api.openai.com,claude.ai,copilot.microsoft.com'],
            'action_config' => ['type' => 'block', 'message' => 'Blocked domain'],
            'priority' => 70,
            'enabled' => true,
        ]);

        $response = $this->signedGet('/api/rules/sync?version=0');

        $rules = $response->json('rules');
        $condition = $rules[0]['condition'];
        $this->assertIsArray($condition['domains']);
        $this->assertEquals(['api.openai.com', 'claude.ai', 'copilot.microsoft.com'], $condition['domains']);
    }

    public function test_content_length_rule_uses_min_max_not_min_max_length(): void
    {
        Rule::create([
            'name' => 'Test Content Length Rule',
            'category' => 'alert',
            'target' => 'prompt',
            'condition_type' => 'content_length',
            'condition_value' => ['min_length' => 100, 'max_length' => 10000],
            'action_config' => ['type' => 'alert', 'severity' => 'warning'],
            'priority' => 30,
            'enabled' => true,
        ]);

        $response = $this->signedGet('/api/rules/sync?version=0');

        $rules = $response->json('rules');
        $condition = $rules[0]['condition'];
        $this->assertEquals('content_length', $condition['type']);
        // Rust expects 'min' and 'max', not 'min_length' and 'max_length'
        $this->assertEquals(100, $condition['min']);
        $this->assertEquals(10000, $condition['max']);
        $this->assertArrayNotHasKey('min_length', $condition);
        $this->assertArrayNotHasKey('max_length', $condition);
    }

    public function test_content_length_rule_already_using_min_max(): void
    {
        Rule::create([
            'name' => 'Test Content Length Native',
            'category' => 'alert',
            'target' => 'prompt',
            'condition_type' => 'content_length',
            'condition_value' => ['min' => 50, 'max' => 5000],
            'action_config' => ['type' => 'alert', 'severity' => 'warning'],
            'priority' => 30,
            'enabled' => true,
        ]);

        $response = $this->signedGet('/api/rules/sync?version=0');

        $rules = $response->json('rules');
        $condition = $rules[0]['condition'];
        $this->assertEquals(50, $condition['min']);
        $this->assertEquals(5000, $condition['max']);
    }

    public function test_regex_rule_format(): void
    {
        Rule::create([
            'name' => 'Test Regex Rule',
            'category' => 'block',
            'target' => 'prompt',
            'condition_type' => 'regex',
            'condition_value' => [
                'pattern' => '\\bsk-[A-Za-z0-9]{20,}\\b',
                'case_insensitive' => false,
            ],
            'action_config' => ['type' => 'block', 'message' => 'API key detected'],
            'priority' => 90,
            'enabled' => true,
        ]);

        $response = $this->signedGet('/api/rules/sync?version=0');

        $rules = $response->json('rules');
        $condition = $rules[0]['condition'];
        $this->assertEquals('regex', $condition['type']);
        $this->assertEquals('\\bsk-[A-Za-z0-9]{20,}\\b', $condition['pattern']);
        $this->assertFalse($condition['case_insensitive']);
    }

    public function test_rule_sync_full_structure_matches_rust_agent(): void
    {
        Rule::create([
            'name' => 'Full Structure Test',
            'description' => 'Tests all fields',
            'category' => 'block',
            'target' => 'prompt',
            'condition_type' => 'keyword',
            'condition_value' => ['keywords' => ['secret', 'password'], 'match_all' => false],
            'action_config' => ['type' => 'block', 'message' => 'Sensitive content detected'],
            'priority' => 80,
            'enabled' => true,
        ]);

        $response = $this->signedGet('/api/rules/sync?version=0');

        $rules = $response->json('rules');
        $rule = $rules[0];

        // Verify all fields expected by the Rust Rule struct
        $this->assertArrayHasKey('id', $rule);
        $this->assertArrayHasKey('name', $rule);
        $this->assertArrayHasKey('version', $rule);
        $this->assertArrayHasKey('category', $rule);
        $this->assertArrayHasKey('target', $rule);
        $this->assertArrayHasKey('condition', $rule);
        $this->assertArrayHasKey('action', $rule);
        $this->assertArrayHasKey('priority', $rule);
        $this->assertArrayHasKey('enabled', $rule);

        // Verify exact values
        $this->assertEquals('Full Structure Test', $rule['name']);
        $this->assertEquals('block', $rule['category']);
        $this->assertEquals('prompt', $rule['target']);
        $this->assertEquals(80, $rule['priority']);
        $this->assertTrue($rule['enabled']);
        $this->assertEquals(['type' => 'block', 'message' => 'Sensitive content detected'], $rule['action']);
    }

    public function test_rule_sync_incremental_by_version(): void
    {
        $rule1 = Rule::create([
            'name' => 'Rule V1',
            'category' => 'log',
            'target' => 'prompt',
            'condition_type' => 'keyword',
            'condition_value' => ['keywords' => ['test']],
            'action_config' => ['type' => 'log'],
            'priority' => 10,
            'enabled' => true,
        ]);

        // Both rules start at version 1 (saving hook: null+1=1)
        $v1 = $rule1->fresh()->version; // 1

        // Update rule1 to bump its version to 2
        $rule1->update(['priority' => 15]);
        $v1Updated = $rule1->fresh()->version; // 2
        $this->assertEquals($v1 + 1, $v1Updated);

        $rule2 = Rule::create([
            'name' => 'Rule V2',
            'category' => 'alert',
            'target' => 'response',
            'condition_type' => 'keyword',
            'condition_value' => ['keywords' => ['confidentiel']],
            'action_config' => ['type' => 'alert', 'severity' => 'warning'],
            'priority' => 20,
            'enabled' => true,
        ]);
        // rule2 has version 1

        // Fetch all rules (version=0)
        $response = $this->signedGet('/api/rules/sync?version=0');
        $this->assertCount(2, $response->json('rules'));

        // Fetch only rules newer than version 1 (should return only rule1 with v2)
        $response = $this->signedGet('/api/rules/sync?version=1');
        $rules = $response->json('rules');
        $this->assertCount(1, $rules);
        $this->assertEquals('Rule V1', $rules[0]['name']);
        $this->assertEquals(2, $rules[0]['version']);
    }

    public function test_disabled_rules_excluded_from_sync(): void
    {
        Rule::create([
            'name' => 'Enabled Rule',
            'category' => 'log',
            'target' => 'prompt',
            'condition_type' => 'keyword',
            'condition_value' => ['keywords' => ['test']],
            'action_config' => ['type' => 'log'],
            'priority' => 10,
            'enabled' => true,
        ]);

        Rule::create([
            'name' => 'Disabled Rule',
            'category' => 'block',
            'target' => 'prompt',
            'condition_type' => 'keyword',
            'condition_value' => ['keywords' => ['disabled']],
            'action_config' => ['type' => 'block', 'message' => 'No'],
            'priority' => 10,
            'enabled' => false,
        ]);

        $response = $this->signedGet('/api/rules/sync?version=0');
        $rules = $response->json('rules');
        $this->assertCount(1, $rules);
        $this->assertEquals('Enabled Rule', $rules[0]['name']);
    }

    // ---------------------------------------------------------------
    // Domain Sync Tests
    // ---------------------------------------------------------------

    public function test_domain_sync_returns_all_domains(): void
    {
        MonitoredDomain::create([
            'domain' => 'api.openai.com',
            'platform_name' => 'ChatGPT',
            'is_blocked' => false,
        ]);
        MonitoredDomain::create([
            'domain' => 'claude.ai',
            'platform_name' => 'Claude',
            'is_blocked' => true,
        ]);

        $response = $this->signedGet('/api/domains/sync');

        $response->assertOk();
        $domains = $response->json('domains');
        $this->assertCount(2, $domains);
    }

    public function test_domain_sync_format_matches_rust_agent(): void
    {
        MonitoredDomain::create([
            'domain' => 'api.openai.com',
            'platform_name' => 'ChatGPT',
            'is_blocked' => false,
        ]);

        $response = $this->signedGet('/api/domains/sync');
        $domains = $response->json('domains');
        $domain = $domains[0];

        // Verify fields expected by Rust DomainFilter
        $this->assertArrayHasKey('domain', $domain);
        $this->assertArrayHasKey('platform_name', $domain);
        $this->assertArrayHasKey('is_blocked', $domain);

        $this->assertEquals('api.openai.com', $domain['domain']);
        $this->assertEquals('ChatGPT', $domain['platform_name']);
        $this->assertFalse($domain['is_blocked']);
    }

    public function test_domain_sync_blocked_flag(): void
    {
        MonitoredDomain::create([
            'domain' => 'chat.openai.com',
            'platform_name' => 'ChatGPT',
            'is_blocked' => true,
        ]);

        $response = $this->signedGet('/api/domains/sync');
        $domains = $response->json('domains');

        $this->assertTrue($domains[0]['is_blocked']);
    }

    public function test_domain_sync_requires_auth(): void
    {
        MonitoredDomain::create([
            'domain' => 'api.openai.com',
            'platform_name' => 'ChatGPT',
            'is_blocked' => false,
        ]);

        // No auth headers
        $response = $this->getJson('/api/domains/sync');
        $response->assertUnauthorized();
    }

    public function test_domain_sync_empty_when_no_domains(): void
    {
        $response = $this->signedGet('/api/domains/sync');

        $response->assertOk();
        $this->assertCount(0, $response->json('domains'));
    }

    // ---------------------------------------------------------------
    // Default Rule Seeder Integration
    // ---------------------------------------------------------------

    public function test_default_rules_produce_valid_agent_format(): void
    {
        // Run the default rule seeder
        $this->seed(\Database\Seeders\DefaultRuleSeeder::class);

        $response = $this->signedGet('/api/rules/sync?version=0');
        $response->assertOk();

        $rules = $response->json('rules');
        $this->assertGreaterThan(0, count($rules));

        foreach ($rules as $rule) {
            // Every rule must have required Rust fields
            $this->assertArrayHasKey('id', $rule);
            $this->assertArrayHasKey('name', $rule);
            $this->assertArrayHasKey('version', $rule);
            $this->assertArrayHasKey('category', $rule);
            $this->assertArrayHasKey('target', $rule);
            $this->assertArrayHasKey('condition', $rule);
            $this->assertArrayHasKey('action', $rule);
            $this->assertArrayHasKey('priority', $rule);
            $this->assertArrayHasKey('enabled', $rule);

            // Condition must have 'type' field (serde tag)
            $this->assertArrayHasKey('type', $rule['condition']);

            // Action must have 'type' field
            $this->assertArrayHasKey('type', $rule['action']);

            // If content_length, verify min/max not min_length/max_length
            if ($rule['condition']['type'] === 'content_length') {
                $this->assertArrayNotHasKey('min_length', $rule['condition']);
                $this->assertArrayNotHasKey('max_length', $rule['condition']);
            }

            // If keyword, verify keywords is an array
            if ($rule['condition']['type'] === 'keyword') {
                $this->assertIsArray($rule['condition']['keywords']);
            }

            // If domain_list, verify domains is an array
            if ($rule['condition']['type'] === 'domain_list') {
                $this->assertIsArray($rule['condition']['domains']);
            }
        }
    }
}
