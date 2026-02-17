<?php

namespace Tests\Feature;

use App\Models\Machine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AgentApiTest extends TestCase
{
    use RefreshDatabase;

    private Machine $machine;
    private string $apiKey = 'test-api-key-for-agent';
    private string $hmacSecret = 'test-hmac-secret';

    protected function setUp(): void
    {
        parent::setUp();

        config(['icon.security.hmac_secret' => $this->hmacSecret]);

        $this->machine = Machine::create([
            'hostname' => 'TEST-MACHINE',
            'os' => 'macos',
            'agent_version' => '0.1.0',
            'api_key_hash' => Hash::make($this->apiKey),
            'status' => 'active',
            'last_heartbeat' => now(),
        ]);
    }

    private function signedHeaders(string $body = ''): array
    {
        return [
            'X-Api-Key' => $this->apiKey,
            'X-Signature' => hash_hmac('sha256', $body, $this->hmacSecret),
            'X-Timestamp' => (string) time(),
        ];
    }

    public function test_api_requires_api_key(): void
    {
        $response = $this->postJson('/api/agents/heartbeat', [
            'machine_id' => $this->machine->id,
            'status' => 'active',
            'agent_version' => '0.1.0',
            'queue_size' => 0,
            'uptime_secs' => 3600,
        ]);

        $response->assertStatus(401);
    }

    public function test_api_rejects_invalid_api_key(): void
    {
        $response = $this->postJson('/api/agents/heartbeat', [
            'machine_id' => $this->machine->id,
            'status' => 'active',
            'agent_version' => '0.1.0',
            'queue_size' => 0,
            'uptime_secs' => 3600,
        ], ['X-Api-Key' => 'wrong-key', 'X-Signature' => 'wrong']);

        $response->assertStatus(401);
    }

    public function test_heartbeat_updates_machine(): void
    {
        $payload = [
            'machine_id' => $this->machine->id,
            'status' => 'active',
            'agent_version' => '0.2.0',
            'queue_size' => 5,
            'uptime_secs' => 7200,
        ];
        $body = json_encode($payload);

        $response = $this->postJson(
            '/api/agents/heartbeat',
            $payload,
            $this->signedHeaders($body),
        );

        $response->assertStatus(200)
            ->assertJsonStructure(['force_sync_rules', 'update_available']);

        $this->machine->refresh();
        $this->assertEquals('0.2.0', $this->machine->agent_version);
        $this->assertEquals('active', $this->machine->status);
    }

    public function test_event_ingestion_accepts_batch(): void
    {
        $payload = [
            'machine_id' => $this->machine->id,
            'events' => [
                [
                    'event_type' => 'prompt',
                    'platform' => 'chatgpt',
                    'domain' => 'api.openai.com',
                    'severity' => 'info',
                    'occurred_at' => now()->toISOString(),
                ],
                [
                    'event_type' => 'block',
                    'platform' => 'claude',
                    'domain' => 'api.anthropic.com',
                    'severity' => 'critical',
                    'occurred_at' => now()->toISOString(),
                ],
            ],
        ];
        $body = json_encode($payload);

        $response = $this->postJson(
            '/api/events',
            $payload,
            $this->signedHeaders($body),
        );

        $response->assertStatus(202)
            ->assertJson(['accepted' => 2]);
    }

    public function test_event_ingestion_validates_events(): void
    {
        $payload = [
            'machine_id' => $this->machine->id,
            'events' => [
                ['platform' => 'chatgpt'], // missing event_type and occurred_at
            ],
        ];
        $body = json_encode($payload);

        $response = $this->postJson(
            '/api/events',
            $payload,
            $this->signedHeaders($body),
        );

        $response->assertStatus(422);
    }

    public function test_rule_sync_returns_rules(): void
    {
        $response = $this->withHeaders([
            'X-Api-Key' => $this->apiKey,
        ])->getJson('/api/rules/sync?version=0');

        $response->assertStatus(200)
            ->assertJsonStructure(['rules', 'deleted_ids']);
    }

    public function test_agent_update_check(): void
    {
        $response = $this->withHeaders([
            'X-Api-Key' => $this->apiKey,
        ])->getJson('/api/agents/update');

        $response->assertStatus(204);
    }
}
