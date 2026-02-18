<?php

namespace Tests\Feature;

use App\Models\Machine;
use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class HeartbeatControllerTest extends TestCase
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
            'hostname' => 'HEARTBEAT-TEST-PC',
            'os' => 'windows',
            'os_version' => '11.0',
            'agent_version' => '0.1.0',
            'api_key_hash' => Hash::make($this->apiKey),
            'api_key_prefix' => substr($this->apiKey, 0, 16),
            'hmac_secret_encrypted' => Crypt::encryptString($this->hmacSecret),
            'status' => 'inactive',
            'last_heartbeat' => now()->subHour(),
        ]);
    }

    private function withAgentAuth(): static
    {
        config(['icon.security.verify_signatures' => false]);

        return $this->withHeaders([
            'X-Api-Key' => $this->apiKey,
        ]);
    }

    private function validHeartbeatPayload(array $overrides = []): array
    {
        return array_merge([
            'machine_id' => $this->machine->id,
            'status' => 'active',
            'agent_version' => '0.1.0',
            'queue_size' => 0,
            'uptime_secs' => 120,
        ], $overrides);
    }

    // ── Success Cases ───────────────────────────────────────────────────

    public function test_heartbeat_returns_success_with_valid_data(): void
    {
        $response = $this->withAgentAuth()
            ->postJson('/api/agents/heartbeat', $this->validHeartbeatPayload());

        $response->assertOk()
            ->assertJsonStructure(['force_sync_rules', 'update_available']);
    }

    public function test_heartbeat_updates_machine_last_heartbeat(): void
    {
        $oldHeartbeat = $this->machine->last_heartbeat;

        $this->withAgentAuth()
            ->postJson('/api/agents/heartbeat', $this->validHeartbeatPayload());

        $this->machine->refresh();
        $this->assertNotEquals($oldHeartbeat->toIso8601String(), $this->machine->last_heartbeat->toIso8601String());
        $this->assertTrue($this->machine->last_heartbeat->isAfter($oldHeartbeat));
    }

    public function test_heartbeat_updates_machine_status_to_active(): void
    {
        $this->assertEquals('inactive', $this->machine->status);

        $this->withAgentAuth()
            ->postJson('/api/agents/heartbeat', $this->validHeartbeatPayload());

        $this->machine->refresh();
        $this->assertEquals('active', $this->machine->status);
    }

    public function test_heartbeat_returns_force_sync_rules_flag(): void
    {
        $response = $this->withAgentAuth()
            ->postJson('/api/agents/heartbeat', $this->validHeartbeatPayload());

        $response->assertOk();
        $this->assertArrayHasKey('force_sync_rules', $response->json());
        $this->assertIsBool($response->json('force_sync_rules'));
    }

    public function test_heartbeat_returns_update_info_when_available(): void
    {
        Setting::setValue('agent_current_version', '2.0.0');
        Setting::setValue('agent_update_url', 'https://example.com/agent.exe');

        $response = $this->withAgentAuth()
            ->postJson('/api/agents/heartbeat', $this->validHeartbeatPayload([
                'agent_version' => '0.1.0',
            ]));

        $response->assertOk();
        $this->assertNotNull($response->json('update_available'));
        $this->assertEquals('2.0.0', $response->json('update_available.version'));
        $this->assertEquals('https://example.com/agent.exe', $response->json('update_available.download_url'));
    }

    public function test_heartbeat_returns_no_update_when_version_current(): void
    {
        Setting::setValue('agent_current_version', '0.1.0');

        $response = $this->withAgentAuth()
            ->postJson('/api/agents/heartbeat', $this->validHeartbeatPayload([
                'agent_version' => '0.1.0',
            ]));

        $response->assertOk();
        $this->assertNull($response->json('update_available'));
    }

    public function test_heartbeat_updates_agent_version(): void
    {
        $this->withAgentAuth()
            ->postJson('/api/agents/heartbeat', $this->validHeartbeatPayload([
                'agent_version' => '0.5.0',
            ]));

        $this->machine->refresh();
        $this->assertEquals('0.5.0', $this->machine->agent_version);
    }

    // ── Validation Errors ───────────────────────────────────────────────

    public function test_heartbeat_rejects_invalid_machine_id(): void
    {
        $this->withAgentAuth()
            ->postJson('/api/agents/heartbeat', $this->validHeartbeatPayload([
                'machine_id' => 'not-a-valid-uuid',
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['machine_id']);
    }

    public function test_heartbeat_rejects_missing_required_fields(): void
    {
        $this->withAgentAuth()
            ->postJson('/api/agents/heartbeat', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors([
                'machine_id',
                'status',
                'agent_version',
                'queue_size',
                'uptime_secs',
            ]);
    }

    public function test_heartbeat_rejects_missing_status(): void
    {
        $payload = $this->validHeartbeatPayload();
        unset($payload['status']);

        $this->withAgentAuth()
            ->postJson('/api/agents/heartbeat', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status']);
    }

    public function test_heartbeat_rejects_missing_agent_version(): void
    {
        $payload = $this->validHeartbeatPayload();
        unset($payload['agent_version']);

        $this->withAgentAuth()
            ->postJson('/api/agents/heartbeat', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['agent_version']);
    }

    // ── Authentication ──────────────────────────────────────────────────

    public function test_heartbeat_requires_authentication(): void
    {
        config(['icon.security.verify_signatures' => false]);

        $this->postJson('/api/agents/heartbeat', $this->validHeartbeatPayload())
            ->assertStatus(401);
    }

    public function test_heartbeat_rejects_invalid_api_key(): void
    {
        config(['icon.security.verify_signatures' => false]);

        $this->withHeaders(['X-Api-Key' => Str::random(64)])
            ->postJson('/api/agents/heartbeat', $this->validHeartbeatPayload())
            ->assertStatus(401);
    }
}
