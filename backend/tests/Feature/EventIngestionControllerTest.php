<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\Machine;
use App\Services\ElasticsearchService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class EventIngestionControllerTest extends TestCase
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
            'hostname' => 'INGESTION-TEST-PC',
            'os' => 'windows',
            'os_version' => '11.0',
            'agent_version' => '0.1.0',
            'api_key_hash' => Hash::make($this->apiKey),
            'api_key_prefix' => substr($this->apiKey, 0, 16),
            'hmac_secret_encrypted' => Crypt::encryptString($this->hmacSecret),
            'status' => 'active',
            'last_heartbeat' => now(),
        ]);

        // Run queue synchronously so events are processed immediately
        config(['queue.default' => 'sync']);

        // Mock Elasticsearch (not available in test environment)
        $this->mock(ElasticsearchService::class, function ($mock) {
            $mock->shouldReceive('indexExchange')
                ->andReturn('es-mock-id-' . uniqid());
        });
    }

    private function withAgentAuth(): static
    {
        config(['icon.security.verify_signatures' => false]);

        return $this->withHeaders([
            'X-Api-Key' => $this->apiKey,
        ]);
    }

    private function validEventPayload(array $overrides = []): array
    {
        return array_merge([
            'machine_id' => $this->machine->id,
            'events' => [
                [
                    'event_type' => 'prompt',
                    'platform' => 'chatgpt',
                    'domain' => 'api.openai.com',
                    'severity' => 'info',
                    'occurred_at' => now()->toIso8601String(),
                ],
            ],
        ], $overrides);
    }

    // ── Success Cases ───────────────────────────────────────────────────

    public function test_ingestion_accepts_valid_event_batch(): void
    {
        $response = $this->withAgentAuth()
            ->postJson('/api/events', $this->validEventPayload());

        $response->assertStatus(202)
            ->assertJson(['accepted' => 1]);
    }

    public function test_ingestion_creates_events_in_database(): void
    {
        $this->withAgentAuth()
            ->postJson('/api/events', $this->validEventPayload());

        $this->assertDatabaseHas('events', [
            'machine_id' => $this->machine->id,
            'event_type' => 'prompt',
            'platform' => 'chatgpt',
            'domain' => 'api.openai.com',
            'severity' => 'info',
        ]);
    }

    public function test_ingestion_handles_multiple_events_in_batch(): void
    {
        $payload = $this->validEventPayload([
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
                    'severity' => 'info',
                    'occurred_at' => now()->toIso8601String(),
                ],
                [
                    'event_type' => 'block',
                    'platform' => 'copilot',
                    'domain' => 'copilot.microsoft.com',
                    'severity' => 'warning',
                    'occurred_at' => now()->toIso8601String(),
                ],
            ],
        ]);

        $response = $this->withAgentAuth()
            ->postJson('/api/events', $payload);

        $response->assertStatus(202)
            ->assertJson(['accepted' => 3]);

        $this->assertEquals(3, Event::where('machine_id', $this->machine->id)->count());
    }

    public function test_ingestion_validates_event_type_field(): void
    {
        $payload = $this->validEventPayload([
            'events' => [
                [
                    'platform' => 'chatgpt',
                    'occurred_at' => now()->toIso8601String(),
                    // missing event_type
                ],
            ],
        ]);

        $this->withAgentAuth()
            ->postJson('/api/events', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['events.0.event_type']);
    }

    public function test_ingestion_stores_metadata_as_json(): void
    {
        $metadata = json_encode(['key' => 'value', 'nested' => ['foo' => 'bar']]);

        $payload = $this->validEventPayload([
            'events' => [
                [
                    'event_type' => 'prompt',
                    'platform' => 'chatgpt',
                    'domain' => 'api.openai.com',
                    'severity' => 'info',
                    'metadata' => $metadata,
                    'occurred_at' => now()->toIso8601String(),
                ],
            ],
        ]);

        $this->withAgentAuth()
            ->postJson('/api/events', $payload);

        $event = Event::where('machine_id', $this->machine->id)->first();
        $this->assertNotNull($event);
        $this->assertIsArray($event->metadata);
        $this->assertEquals('value', $event->metadata['key']);
        $this->assertEquals('bar', $event->metadata['nested']['foo']);
    }

    public function test_ingestion_requires_machine_id(): void
    {
        $payload = $this->validEventPayload();
        unset($payload['machine_id']);

        $this->withAgentAuth()
            ->postJson('/api/events', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['machine_id']);
    }

    public function test_ingestion_requires_occurred_at(): void
    {
        $payload = $this->validEventPayload([
            'events' => [
                [
                    'event_type' => 'prompt',
                    'platform' => 'chatgpt',
                    // missing occurred_at
                ],
            ],
        ]);

        $this->withAgentAuth()
            ->postJson('/api/events', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['events.0.occurred_at']);
    }

    // ── Authentication ──────────────────────────────────────────────────

    public function test_ingestion_requires_authentication(): void
    {
        config(['icon.security.verify_signatures' => false]);

        $this->postJson('/api/events', $this->validEventPayload())
            ->assertStatus(401);
    }

    public function test_ingestion_rejects_invalid_api_key(): void
    {
        config(['icon.security.verify_signatures' => false]);

        $this->withHeaders(['X-Api-Key' => Str::random(64)])
            ->postJson('/api/events', $this->validEventPayload())
            ->assertStatus(401);
    }

    // ── Rate Limiting ───────────────────────────────────────────────────

    public function test_ingestion_respects_rate_limiting(): void
    {
        // Event ingestion is rate-limited to 30 requests/minute per machine
        for ($i = 0; $i < 30; $i++) {
            $this->withAgentAuth()
                ->postJson('/api/events', $this->validEventPayload())
                ->assertStatus(202);
        }

        // The 31st request should be rate-limited
        $this->withAgentAuth()
            ->postJson('/api/events', $this->validEventPayload())
            ->assertStatus(429);
    }

    // ── Edge Cases ──────────────────────────────────────────────────────

    public function test_ingestion_handles_empty_batch(): void
    {
        $payload = $this->validEventPayload([
            'events' => [],
        ]);

        // An empty array fails the 'required' validation rule in Laravel,
        // which considers empty arrays as "not present".
        $this->withAgentAuth()
            ->postJson('/api/events', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['events']);
    }

    public function test_ingestion_rejects_oversized_batch(): void
    {
        $events = [];
        for ($i = 0; $i < 101; $i++) {
            $events[] = [
                'event_type' => 'prompt',
                'occurred_at' => now()->toIso8601String(),
            ];
        }

        $payload = $this->validEventPayload(['events' => $events]);

        $this->withAgentAuth()
            ->postJson('/api/events', $payload)
            ->assertStatus(422);
    }

    public function test_ingestion_accepts_optional_fields_as_null(): void
    {
        $payload = $this->validEventPayload([
            'events' => [
                [
                    'event_type' => 'prompt',
                    'platform' => null,
                    'domain' => null,
                    'content_hash' => null,
                    'prompt_excerpt' => null,
                    'response_excerpt' => null,
                    'rule_id' => null,
                    'severity' => null,
                    'metadata' => null,
                    'occurred_at' => now()->toIso8601String(),
                ],
            ],
        ]);

        $response = $this->withAgentAuth()
            ->postJson('/api/events', $payload);

        $response->assertStatus(202)
            ->assertJson(['accepted' => 1]);
    }
}
