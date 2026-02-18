<?php

namespace Tests\Feature;

use App\Models\Machine;
use App\Models\MonitoredDomain;
use App\Models\Rule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class AgentApiTest extends TestCase
{
    use RefreshDatabase;

    private string $apiKey;
    private string $hmacSecret;
    private Machine $machine;

    protected function setUp(): void
    {
        parent::setUp();

        $this->apiKey = Str::random(64);
        $this->hmacSecret = Str::random(64);

        $this->machine = Machine::create([
            'hostname' => 'TEST-PC',
            'os' => 'windows',
            'agent_version' => '0.1.0',
            'api_key_hash' => Hash::make($this->apiKey),
            'api_key_prefix' => substr($this->apiKey, 0, 16),
            'hmac_secret_encrypted' => Crypt::encryptString($this->hmacSecret),
            'status' => 'active',
            'last_heartbeat' => now(),
        ]);
    }

    // ── Health ──────────────────────────────────────────────────────────

    public function test_health_endpoint(): void
    {
        $this->getJson('/api/health')
            ->assertOk()
            ->assertJson(['status' => 'ok']);
    }

    // ── Registration ────────────────────────────────────────────────────

    public function test_registration_creates_machine(): void
    {
        $response = $this->postJson('/api/agents/register', [
            'hostname' => 'NEW-PC',
            'os' => 'windows',
            'agent_version' => '0.1.0',
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure(['machine_id', 'api_key', 'hmac_secret']);

        $this->assertDatabaseHas('machines', [
            'hostname' => 'NEW-PC',
            'os' => 'windows',
        ]);

        // Verify prefix and HMAC secret were stored
        $machine = Machine::find($response->json('machine_id'));
        $apiKey = $response->json('api_key');
        $this->assertEquals(substr($apiKey, 0, 16), $machine->api_key_prefix);
        $this->assertNotNull($machine->hmac_secret_encrypted);
    }

    public function test_registration_validates_os(): void
    {
        $this->postJson('/api/agents/register', [
            'hostname' => 'NEW-PC',
            'os' => 'linux',
            'agent_version' => '0.1.0',
        ])->assertStatus(422);
    }

    public function test_registration_requires_hostname(): void
    {
        $this->postJson('/api/agents/register', [
            'os' => 'windows',
            'agent_version' => '0.1.0',
        ])->assertStatus(422);
    }

    public function test_registration_rejects_bad_enrollment_key(): void
    {
        config(['icon.agent.registration_key' => 'secret-enroll-key']);

        $this->postJson('/api/agents/register', [
            'hostname' => 'NEW-PC',
            'os' => 'windows',
            'agent_version' => '0.1.0',
        ], ['X-Enrollment-Key' => 'wrong-key'])
            ->assertStatus(403);
    }

    public function test_registration_accepts_valid_enrollment_key(): void
    {
        config(['icon.agent.registration_key' => 'secret-enroll-key']);

        $this->postJson('/api/agents/register', [
            'hostname' => 'NEW-PC',
            'os' => 'windows',
            'agent_version' => '0.1.0',
        ], ['X-Enrollment-Key' => 'secret-enroll-key'])
            ->assertStatus(201);
    }

    // ── Authentication ──────────────────────────────────────────────────

    public function test_api_requires_api_key(): void
    {
        $this->postJson('/api/agents/heartbeat', [
            'machine_id' => $this->machine->id,
            'status' => 'active',
            'agent_version' => '0.1.0',
            'queue_size' => 0,
            'uptime_secs' => 120,
        ])->assertStatus(401);
    }

    public function test_api_rejects_invalid_key(): void
    {
        $fakeKey = Str::random(64);

        $this->postJson('/api/agents/heartbeat', [
            'machine_id' => $this->machine->id,
            'status' => 'active',
            'agent_version' => '0.1.0',
            'queue_size' => 0,
            'uptime_secs' => 120,
        ], ['X-Api-Key' => $fakeKey, 'X-Signature' => 'x'])
            ->assertStatus(401);
    }

    // ── Heartbeat ───────────────────────────────────────────────────────

    public function test_heartbeat_updates_machine(): void
    {
        $response = $this->withAgentAuth()
            ->postJson('/api/agents/heartbeat', [
                'machine_id' => $this->machine->id,
                'status' => 'active',
                'agent_version' => '0.2.0',
                'queue_size' => 5,
                'uptime_secs' => 3600,
            ]);

        $response->assertOk()
            ->assertJsonStructure(['force_sync_rules', 'update_available']);

        $this->machine->refresh();
        $this->assertEquals('0.2.0', $this->machine->agent_version);
        $this->assertEquals('active', $this->machine->status);
    }

    public function test_heartbeat_detects_update(): void
    {
        config(['icon.agent.current_version' => '0.5.0']);

        $response = $this->withAgentAuth()
            ->postJson('/api/agents/heartbeat', [
                'machine_id' => $this->machine->id,
                'status' => 'active',
                'agent_version' => '0.1.0',
                'queue_size' => 0,
                'uptime_secs' => 60,
            ]);

        $response->assertOk();
        $this->assertNotNull($response->json('update_available'));
        $this->assertEquals('0.5.0', $response->json('update_available.version'));
    }

    // ── Event Ingestion ─────────────────────────────────────────────────

    public function test_event_ingestion_accepts_batch(): void
    {
        $response = $this->withAgentAuth()
            ->postJson('/api/events', [
                'machine_id' => $this->machine->id,
                'events' => [
                    [
                        'event_type' => 'prompt',
                        'platform' => 'chatgpt',
                        'domain' => 'api.openai.com',
                        'severity' => 'info',
                        'occurred_at' => now()->toIso8601String(),
                    ],
                    [
                        'event_type' => 'prompt',
                        'platform' => 'claude',
                        'domain' => 'api.anthropic.com',
                        'severity' => 'warning',
                        'occurred_at' => now()->toIso8601String(),
                    ],
                ],
            ]);

        $response->assertStatus(202)
            ->assertJson(['accepted' => 2]);
    }

    public function test_event_ingestion_rejects_oversized_batch(): void
    {
        $events = [];
        for ($i = 0; $i < 101; $i++) {
            $events[] = [
                'event_type' => 'prompt',
                'occurred_at' => now()->toIso8601String(),
            ];
        }

        $this->withAgentAuth()
            ->postJson('/api/events', [
                'machine_id' => $this->machine->id,
                'events' => $events,
            ])
            ->assertStatus(422);
    }

    public function test_event_ingestion_validates_required_fields(): void
    {
        $this->withAgentAuth()
            ->postJson('/api/events', [
                'machine_id' => $this->machine->id,
                'events' => [
                    ['platform' => 'chatgpt'], // missing event_type and occurred_at
                ],
            ])
            ->assertStatus(422);
    }

    // ── Rule Sync ───────────────────────────────────────────────────────

    public function test_rule_sync_returns_rules(): void
    {
        $admin = User::create([
            'name' => 'Admin',
            'email' => 'admin@gs2e.ci',
            'password' => 'password',
            'role' => 'admin',
        ]);

        Rule::create([
            'name' => 'Block passwords',
            'category' => 'block',
            'target' => 'prompt',
            'condition_type' => 'keyword',
            'condition_value' => ['keywords' => ['password', 'mot de passe']],
            'priority' => 100,
            'created_by' => $admin->id,
        ]);

        $response = $this->withAgentAuth()
            ->getJson('/api/rules/sync?version=0');

        $response->assertOk()
            ->assertJsonStructure([
                'rules' => [['id', 'name', 'version', 'category', 'target', 'condition', 'action', 'priority', 'enabled']],
                'deleted_ids',
            ]);

        $this->assertCount(1, $response->json('rules'));
        $this->assertEquals('Block passwords', $response->json('rules.0.name'));
    }

    public function test_rule_sync_incremental(): void
    {
        $admin = User::create([
            'name' => 'Admin',
            'email' => 'admin@gs2e.ci',
            'password' => 'password',
            'role' => 'admin',
        ]);

        $rule = Rule::create([
            'name' => 'Old rule',
            'category' => 'log',
            'target' => 'prompt',
            'condition_type' => 'keyword',
            'condition_value' => ['keywords' => ['test']],
            'priority' => 0,
            'created_by' => $admin->id,
        ]);

        // Version is 1 after creation — requesting version >= 1 should return nothing
        $response = $this->withAgentAuth()
            ->getJson('/api/rules/sync?version=' . $rule->version);

        $response->assertOk();
        $this->assertCount(0, $response->json('rules'));
    }

    public function test_rule_sync_excludes_disabled_rules(): void
    {
        $admin = User::create([
            'name' => 'Admin',
            'email' => 'admin@gs2e.ci',
            'password' => 'password',
            'role' => 'admin',
        ]);

        Rule::create([
            'name' => 'Disabled rule',
            'category' => 'log',
            'target' => 'prompt',
            'condition_type' => 'keyword',
            'condition_value' => ['keywords' => ['test']],
            'priority' => 0,
            'enabled' => false,
            'created_by' => $admin->id,
        ]);

        $response = $this->withAgentAuth()
            ->getJson('/api/rules/sync?version=0');

        $response->assertOk();
        $this->assertCount(0, $response->json('rules'));
    }

    // ── Domain Sync ─────────────────────────────────────────────────────

    public function test_domain_sync_returns_domains(): void
    {
        MonitoredDomain::create([
            'domain' => 'api.openai.com',
            'platform_name' => 'ChatGPT',
            'is_blocked' => true,
        ]);

        MonitoredDomain::create([
            'domain' => 'claude.ai',
            'platform_name' => 'Claude',
            'is_blocked' => false,
        ]);

        $response = $this->withAgentAuth()
            ->getJson('/api/domains/sync');

        $response->assertOk()
            ->assertJsonCount(2, 'domains');
    }

    // ── Watchdog Alert ──────────────────────────────────────────────────

    public function test_watchdog_alert_creates_alert(): void
    {
        $response = $this->withAgentAuth()
            ->postJson('/api/agents/watchdog-alert', [
                'alert_type' => 'binary_tampered',
                'message' => 'Agent binary hash mismatch detected',
                'source' => 'watchdog',
                'agent_version' => '0.1.0',
            ]);

        $response->assertOk()
            ->assertJson(['received' => true]);

        $this->assertDatabaseHas('alerts', [
            'machine_id' => $this->machine->id,
            'severity' => 'critical',
        ]);
    }

    public function test_watchdog_alert_maps_severity(): void
    {
        $this->withAgentAuth()
            ->postJson('/api/agents/watchdog-alert', [
                'alert_type' => 'agent_restarted',
                'message' => 'Agent was restarted by watchdog',
                'source' => 'watchdog',
            ]);

        $this->assertDatabaseHas('alerts', [
            'machine_id' => $this->machine->id,
            'severity' => 'warning',
        ]);
    }

    // ── HMAC Verification ───────────────────────────────────────────────

    public function test_hmac_signature_required_for_post(): void
    {
        config(['icon.security.verify_signatures' => true]);

        $timestamp = (string) time();

        $this->postJson('/api/agents/heartbeat', [
            'machine_id' => $this->machine->id,
            'status' => 'active',
            'agent_version' => '0.1.0',
            'queue_size' => 0,
            'uptime_secs' => 60,
        ], ['X-Api-Key' => $this->apiKey, 'X-Timestamp' => $timestamp])
            ->assertStatus(401)
            ->assertJson(['error' => 'Missing HMAC signature']);
    }

    public function test_hmac_invalid_signature_rejected(): void
    {
        config(['icon.security.verify_signatures' => true]);

        $timestamp = (string) time();

        $this->postJson('/api/agents/heartbeat', [
            'machine_id' => $this->machine->id,
            'status' => 'active',
            'agent_version' => '0.1.0',
            'queue_size' => 0,
            'uptime_secs' => 60,
        ], [
            'X-Api-Key' => $this->apiKey,
            'X-Signature' => 'invalid-signature',
            'X-Timestamp' => $timestamp,
        ])
            ->assertStatus(401)
            ->assertJson(['error' => 'Invalid HMAC signature']);
    }

    public function test_hmac_valid_signature_accepted(): void
    {
        config(['icon.security.verify_signatures' => true]);

        $timestamp = (string) time();

        $payload = json_encode([
            'machine_id' => $this->machine->id,
            'status' => 'active',
            'agent_version' => '0.1.0',
            'queue_size' => 0,
            'uptime_secs' => 60,
        ]);

        $signature = hash_hmac('sha256', $timestamp . '.' . $payload, $this->hmacSecret);

        $this->call('POST', '/api/agents/heartbeat', [], [], [], [
            'HTTP_X-Api-Key' => $this->apiKey,
            'HTTP_X-Signature' => $signature,
            'HTTP_X-Timestamp' => $timestamp,
            'CONTENT_TYPE' => 'application/json',
        ], $payload)
            ->assertOk();
    }

    public function test_hmac_skipped_for_get_requests(): void
    {
        config(['icon.security.verify_signatures' => true]);

        $this->withHeaders(['X-Api-Key' => $this->apiKey])
            ->getJson('/api/rules/sync?version=0')
            ->assertOk();
    }

    // ── Agent Update Check ──────────────────────────────────────────────

    public function test_agent_update_check_no_update(): void
    {
        $this->withAgentAuth()
            ->getJson('/api/agents/update?current_version=99.0.0&os=windows')
            ->assertOk()
            ->assertJson(['update_available' => false]);
    }

    public function test_agent_update_check_update_available(): void
    {
        \App\Models\Setting::setValue('agent_current_version', '2.0.0');
        \App\Models\Setting::setValue('agent_update_url', 'https://example.com/agent.exe');

        $this->withAgentAuth()
            ->getJson('/api/agents/update?current_version=1.0.0&os=windows')
            ->assertOk()
            ->assertJson([
                'update_available' => true,
                'version' => '2.0.0',
                'download_url' => 'https://example.com/agent.exe',
            ]);
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private function withAgentAuth(): static
    {
        config(['icon.security.verify_signatures' => false]);

        return $this->withHeaders([
            'X-Api-Key' => $this->apiKey,
        ]);
    }
}
