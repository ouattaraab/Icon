<?php

namespace Tests\Feature;

use App\Models\Machine;
use App\Models\Rule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class RuleSyncControllerTest extends TestCase
{
    use RefreshDatabase;

    private string $apiKey;

    private string $hmacSecret;

    private Machine $machine;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();

        $this->apiKey = Str::random(64);
        $this->hmacSecret = Str::random(64);

        $this->machine = Machine::create([
            'hostname' => 'RULE-SYNC-TEST-PC',
            'os' => 'windows',
            'os_version' => '11.0',
            'agent_version' => '0.1.0',
            'api_key_hash' => Hash::make($this->apiKey),
            'api_key_prefix' => substr($this->apiKey, 0, 16),
            'hmac_secret_encrypted' => Crypt::encryptString($this->hmacSecret),
            'status' => 'active',
            'last_heartbeat' => now(),
        ]);

        $this->admin = User::create([
            'name' => 'Admin',
            'email' => 'admin-rule-sync@gs2e.ci',
            'password' => bcrypt('password'),
            'role' => 'admin',
        ]);
    }

    private function withAgentAuth(): static
    {
        config(['icon.security.verify_signatures' => false]);

        return $this->withHeaders([
            'X-Api-Key' => $this->apiKey,
        ]);
    }

    private function createRule(array $overrides = []): Rule
    {
        return Rule::create(array_merge([
            'name' => 'Test Rule',
            'category' => 'block',
            'target' => 'prompt',
            'condition_type' => 'keyword',
            'condition_value' => ['keywords' => ['password', 'secret']],
            'action_config' => ['type' => 'block', 'message' => 'Blocked'],
            'priority' => 50,
            'enabled' => true,
            'created_by' => $this->admin->id,
        ], $overrides));
    }

    // ── Full Sync (version = 0) ─────────────────────────────────────────

    public function test_sync_returns_all_rules_when_version_zero(): void
    {
        $this->createRule(['name' => 'Rule A', 'priority' => 100]);
        $this->createRule(['name' => 'Rule B', 'priority' => 50]);
        $this->createRule(['name' => 'Rule C', 'priority' => 10]);

        $response = $this->withAgentAuth()
            ->getJson('/api/rules/sync?version=0');

        $response->assertOk()
            ->assertJsonStructure([
                'rules' => [['id', 'name', 'version', 'category', 'target', 'condition', 'action', 'priority', 'enabled']],
                'deleted_ids',
            ]);

        $this->assertCount(3, $response->json('rules'));
    }

    // ── Incremental Sync ────────────────────────────────────────────────

    public function test_sync_returns_only_newer_rules(): void
    {
        $ruleA = $this->createRule(['name' => 'Rule A', 'priority' => 100]);
        $versionA = $ruleA->fresh()->version; // version 1

        // Update Rule A to bump its version to 2
        $ruleA->update(['priority' => 90]);
        $versionAUpdated = $ruleA->fresh()->version; // version 2

        $ruleB = $this->createRule(['name' => 'Rule B', 'priority' => 50]);
        // Rule B has version 1

        // Request only rules newer than version 1
        $response = $this->withAgentAuth()
            ->getJson('/api/rules/sync?version=1');

        $response->assertOk();
        $rules = $response->json('rules');
        $this->assertCount(1, $rules);
        $this->assertEquals('Rule A', $rules[0]['name']);
        $this->assertEquals(2, $rules[0]['version']);
    }

    public function test_sync_returns_no_rules_when_already_up_to_date(): void
    {
        $rule = $this->createRule(['name' => 'Up-to-date Rule']);
        $currentVersion = $rule->fresh()->version;

        $response = $this->withAgentAuth()
            ->getJson('/api/rules/sync?version=' . $currentVersion);

        $response->assertOk();
        $this->assertCount(0, $response->json('rules'));
    }

    // ── Deleted Rules ───────────────────────────────────────────────────

    public function test_sync_returns_deleted_rule_ids(): void
    {
        // Simulate deleted rules in cache
        Cache::put('icon:deleted_rules', [
            ['rule_id' => 'aaa-bbb-ccc', 'deleted_at_version' => 5],
            ['rule_id' => 'ddd-eee-fff', 'deleted_at_version' => 3],
        ]);

        $response = $this->withAgentAuth()
            ->getJson('/api/rules/sync?version=2');

        $response->assertOk();
        $deletedIds = $response->json('deleted_ids');
        $this->assertContains('aaa-bbb-ccc', $deletedIds);
        $this->assertContains('ddd-eee-fff', $deletedIds);
    }

    public function test_sync_filters_deleted_rules_by_version(): void
    {
        Cache::put('icon:deleted_rules', [
            ['rule_id' => 'old-delete', 'deleted_at_version' => 2],
            ['rule_id' => 'new-delete', 'deleted_at_version' => 5],
        ]);

        // Version 3: should only return deletions after version 3
        $response = $this->withAgentAuth()
            ->getJson('/api/rules/sync?version=3');

        $response->assertOk();
        $deletedIds = $response->json('deleted_ids');
        $this->assertContains('new-delete', $deletedIds);
        $this->assertNotContains('old-delete', $deletedIds);
    }

    // ── Rule Conditions ─────────────────────────────────────────────────

    public function test_sync_includes_rule_conditions(): void
    {
        $this->createRule([
            'name' => 'Keyword Rule',
            'condition_type' => 'keyword',
            'condition_value' => ['keywords' => ['secret', 'password'], 'match_all' => false],
        ]);

        $response = $this->withAgentAuth()
            ->getJson('/api/rules/sync?version=0');

        $response->assertOk();
        $rules = $response->json('rules');
        $this->assertCount(1, $rules);

        $condition = $rules[0]['condition'];
        $this->assertEquals('keyword', $condition['type']);
        $this->assertIsArray($condition['keywords']);
        $this->assertEquals(['secret', 'password'], $condition['keywords']);
        $this->assertFalse($condition['match_all']);
    }

    public function test_sync_includes_action_config(): void
    {
        $this->createRule([
            'action_config' => ['type' => 'block', 'message' => 'Content blocked by policy'],
        ]);

        $response = $this->withAgentAuth()
            ->getJson('/api/rules/sync?version=0');

        $response->assertOk();
        $rules = $response->json('rules');
        $action = $rules[0]['action'];
        $this->assertEquals('block', $action['type']);
        $this->assertEquals('Content blocked by policy', $action['message']);
    }

    public function test_sync_returns_rules_ordered_by_priority(): void
    {
        $this->createRule(['name' => 'Low Priority', 'priority' => 10]);
        $this->createRule(['name' => 'High Priority', 'priority' => 100]);
        $this->createRule(['name' => 'Medium Priority', 'priority' => 50]);

        $response = $this->withAgentAuth()
            ->getJson('/api/rules/sync?version=0');

        $response->assertOk();
        $rules = $response->json('rules');
        $this->assertEquals('High Priority', $rules[0]['name']);
        $this->assertEquals('Medium Priority', $rules[1]['name']);
        $this->assertEquals('Low Priority', $rules[2]['name']);
    }

    // ── Enabled/Disabled Rules ──────────────────────────────────────────

    public function test_sync_only_returns_enabled_rules(): void
    {
        $this->createRule(['name' => 'Enabled Rule', 'enabled' => true]);
        $this->createRule(['name' => 'Disabled Rule', 'enabled' => false]);

        $response = $this->withAgentAuth()
            ->getJson('/api/rules/sync?version=0');

        $response->assertOk();
        $rules = $response->json('rules');
        $this->assertCount(1, $rules);
        $this->assertEquals('Enabled Rule', $rules[0]['name']);
    }

    // ── Authentication ──────────────────────────────────────────────────

    public function test_sync_requires_authentication(): void
    {
        config(['icon.security.verify_signatures' => false]);

        $this->getJson('/api/rules/sync?version=0')
            ->assertStatus(401);
    }

    public function test_sync_rejects_invalid_api_key(): void
    {
        config(['icon.security.verify_signatures' => false]);

        $this->withHeaders(['X-Api-Key' => Str::random(64)])
            ->getJson('/api/rules/sync?version=0')
            ->assertStatus(401);
    }

    // ── Edge Cases ──────────────────────────────────────────────────────

    public function test_sync_returns_empty_when_no_rules_exist(): void
    {
        $response = $this->withAgentAuth()
            ->getJson('/api/rules/sync?version=0');

        $response->assertOk()
            ->assertJson([
                'rules' => [],
                'deleted_ids' => [],
            ]);
    }

    public function test_sync_defaults_version_to_zero_when_missing(): void
    {
        $this->createRule(['name' => 'Default Version Rule']);

        $response = $this->withAgentAuth()
            ->getJson('/api/rules/sync');

        $response->assertOk();
        $this->assertCount(1, $response->json('rules'));
    }
}
