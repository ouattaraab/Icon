<?php

namespace Tests\Feature;

use App\Models\Alert;
use App\Models\Event;
use App\Models\Machine;
use App\Models\Rule;
use App\Models\User;
use App\Services\ElasticsearchService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * End-to-end integration test simulating the complete agent lifecycle:
 * Registration → Heartbeat → Event ingestion → DLP scan → Alert generation → Dashboard.
 *
 * Elasticsearch is mocked since it's not available in the test environment.
 * The queue is set to 'sync' so ProcessEventBatch runs immediately.
 */
class EndToEndAgentTest extends TestCase
{
    use RefreshDatabase;

    private string $hmacSecret = 'e2e-test-hmac-secret';
    private string $apiKey;
    private string $machineId;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'icon.security.hmac_secret' => $this->hmacSecret,
            'icon.security.verify_signatures' => true,
            'icon.dlp.enabled' => true,
            'icon.dlp.auto_alert' => true,
            'queue.default' => 'sync',
        ]);

        // Mock Elasticsearch (not available in test env)
        $this->mock(ElasticsearchService::class, function ($mock) {
            $mock->shouldReceive('indexExchange')
                ->andReturn('es-mock-id-' . uniqid());
        });

        // Create admin for dashboard access
        $this->admin = User::create([
            'name' => 'Admin E2E',
            'email' => 'admin-e2e@gs2e.ci',
            'password' => bcrypt('password'),
            'role' => 'admin',
        ]);
    }

    private function signedHeaders(string $body): array
    {
        $timestamp = (string) time();
        return [
            'X-Api-Key' => $this->apiKey,
            'X-Signature' => hash_hmac('sha256', $timestamp . '.' . $body, $this->hmacSecret),
            'X-Timestamp' => $timestamp,
        ];
    }

    // ───── Step 1: Registration ─────

    public function test_e2e_step1_agent_registers_successfully(): void
    {
        $response = $this->postJson('/api/agents/register', [
            'hostname' => 'E2E-DESKTOP-01',
            'os' => 'windows',
            'os_version' => '11.0.22631',
            'agent_version' => '0.1.0',
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure(['machine_id', 'api_key', 'hmac_secret']);

        $data = $response->json();
        $this->apiKey = $data['api_key'];
        $this->machineId = $data['machine_id'];
        $this->hmacSecret = $data['hmac_secret'];

        // Machine exists in DB
        $this->assertDatabaseHas('machines', [
            'id' => $this->machineId,
            'hostname' => 'E2E-DESKTOP-01',
            'os' => 'windows',
            'status' => 'active',
        ]);

        // Audit log created
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'machine.registered',
            'target_type' => 'Machine',
            'target_id' => $this->machineId,
        ]);
    }

    // ───── Step 2: Heartbeat ─────

    public function test_e2e_step2_heartbeat_updates_machine_status(): void
    {
        $this->registerAgent();

        $payload = [
            'machine_id' => $this->machineId,
            'status' => 'active',
            'agent_version' => '0.2.0',
            'queue_size' => 3,
            'uptime_secs' => 3600,
        ];
        $body = json_encode($payload);

        $response = $this->postJson(
            '/api/agents/heartbeat',
            $payload,
            $this->signedHeaders($body),
        );

        $response->assertStatus(200)
            ->assertJsonStructure(['force_sync_rules', 'update_available']);

        // Machine updated in DB
        $machine = Machine::find($this->machineId);
        $this->assertEquals('0.2.0', $machine->agent_version);
        $this->assertEquals('active', $machine->status);
        $this->assertNotNull($machine->last_heartbeat);
    }

    // ───── Step 3: Event ingestion (normal event — no DLP trigger) ─────

    public function test_e2e_step3_normal_event_ingestion(): void
    {
        $this->registerAgent();

        $payload = [
            'machine_id' => $this->machineId,
            'events' => [
                [
                    'event_type' => 'prompt',
                    'platform' => 'chatgpt',
                    'domain' => 'api.openai.com',
                    'prompt_excerpt' => 'Quelle est la capitale de la France ?',
                    'severity' => 'info',
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
            ->assertJson(['accepted' => 1]);

        // Event stored in PostgreSQL (sync queue processes immediately)
        $this->assertDatabaseHas('events', [
            'machine_id' => $this->machineId,
            'event_type' => 'prompt',
            'platform' => 'chatgpt',
            'severity' => 'info',
        ]);

        // No alert for info severity
        $this->assertEquals(0, Alert::where('machine_id', $this->machineId)->count());
    }

    // ───── Step 4: Event with DLP-triggering content (credentials) ─────

    public function test_e2e_step4_dlp_detects_credentials_and_creates_alert(): void
    {
        $this->registerAgent();

        $payload = [
            'machine_id' => $this->machineId,
            'events' => [
                [
                    'event_type' => 'prompt',
                    'platform' => 'chatgpt',
                    'domain' => 'api.openai.com',
                    'prompt_excerpt' => 'Aide-moi avec ce code. Mon api_key = sk-abcdefghijklmnopqrstuvwxyz1234567890',
                    'severity' => 'info',
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

        $response->assertStatus(202);

        // Event stored with escalated severity (DLP auto_alert)
        $event = Event::where('machine_id', $this->machineId)
            ->where('platform', 'chatgpt')
            ->latest()
            ->first();
        $this->assertNotNull($event);
        $this->assertEquals('critical', $event->severity);

        // DLP results stored in metadata
        $this->assertNotNull($event->metadata);
        $this->assertArrayHasKey('dlp_matches', $event->metadata);
        $this->assertArrayHasKey('credentials', $event->metadata['dlp_matches']);

        // Alert created for critical event
        $alert = Alert::where('event_id', $event->id)->first();
        $this->assertNotNull($alert);
        $this->assertEquals('critical', $alert->severity);
        $this->assertEquals('open', $alert->status);
        $this->assertEquals($this->machineId, $alert->machine_id);
    }

    // ───── Step 5: Event with GS2E internal data (warning → critical) ─────

    public function test_e2e_step5_dlp_detects_internal_data(): void
    {
        $this->registerAgent();

        $payload = [
            'machine_id' => $this->machineId,
            'events' => [
                [
                    'event_type' => 'prompt',
                    'platform' => 'claude',
                    'domain' => 'api.anthropic.com',
                    'prompt_excerpt' => 'Voici le contrat CTR-20240156 concernant le projet GS2E-8847 confidentiel',
                    'severity' => 'info',
                    'occurred_at' => now()->toISOString(),
                ],
            ],
        ];
        $body = json_encode($payload);

        $this->postJson('/api/events', $payload, $this->signedHeaders($body));

        $event = Event::where('machine_id', $this->machineId)
            ->where('platform', 'claude')
            ->latest()
            ->first();

        $this->assertNotNull($event);
        // DLP found gs2e_internal patterns (critical) → severity escalated
        $this->assertEquals('critical', $event->severity);
        $this->assertArrayHasKey('dlp_matches', $event->metadata);

        // Alert generated
        $this->assertDatabaseHas('alerts', [
            'event_id' => $event->id,
            'severity' => 'critical',
            'status' => 'open',
        ]);
    }

    // ───── Step 6: Batch events with mixed severities ─────

    public function test_e2e_step6_batch_events_mixed_severity(): void
    {
        $this->registerAgent();

        $payload = [
            'machine_id' => $this->machineId,
            'events' => [
                [
                    'event_type' => 'prompt',
                    'platform' => 'chatgpt',
                    'domain' => 'api.openai.com',
                    'prompt_excerpt' => 'Comment faire un gâteau au chocolat ?',
                    'severity' => 'info',
                    'occurred_at' => now()->subMinutes(5)->toISOString(),
                ],
                [
                    'event_type' => 'block',
                    'platform' => 'copilot',
                    'domain' => 'copilot.microsoft.com',
                    'prompt_excerpt' => 'Voici mon password = SuperSecret123!',
                    'severity' => 'warning',
                    'occurred_at' => now()->subMinutes(3)->toISOString(),
                ],
                [
                    'event_type' => 'prompt',
                    'platform' => 'gemini',
                    'domain' => 'gemini.google.com',
                    'prompt_excerpt' => 'Explique-moi les réseaux neuronaux',
                    'severity' => 'info',
                    'occurred_at' => now()->subMinutes(1)->toISOString(),
                ],
            ],
        ];
        $body = json_encode($payload);

        $response = $this->postJson(
            '/api/events',
            $payload,
            $this->signedHeaders($body),
        );

        $response->assertStatus(202)->assertJson(['accepted' => 3]);

        // All 3 events stored
        $events = Event::where('machine_id', $this->machineId)->get();
        $this->assertEquals(3, $events->count());

        // Only the credential event should generate an alert (DLP escalates to critical)
        $alerts = Alert::where('machine_id', $this->machineId)->get();
        $this->assertGreaterThanOrEqual(1, $alerts->count());

        // At least one alert for the block event with password
        $blockAlert = Alert::where('machine_id', $this->machineId)
            ->where('severity', 'critical')
            ->first();
        $this->assertNotNull($blockAlert);
    }

    // ───── Step 7: Rule sync returns rules ─────

    public function test_e2e_step7_rule_sync_after_registration(): void
    {
        $this->registerAgent();

        // Create a rule
        Rule::create([
            'name' => 'Block OpenAI API Keys',
            'description' => 'Block prompts containing OpenAI API keys',
            'category' => 'block',
            'target' => 'prompt',
            'condition_type' => 'regex',
            'condition_value' => ['pattern' => 'sk-[A-Za-z0-9]{20,}', 'flags' => 'i'],
            'action_config' => ['type' => 'block', 'message' => 'API key detected'],
            'priority' => 100,
            'enabled' => true,
            'version' => 1,
        ]);

        $response = $this->withHeaders([
            'X-Api-Key' => $this->apiKey,
        ])->getJson('/api/rules/sync?version=0');

        $response->assertStatus(200)
            ->assertJsonStructure(['rules', 'deleted_ids']);

        $rules = $response->json('rules');
        $this->assertNotEmpty($rules);
        $this->assertEquals('Block OpenAI API Keys', $rules[0]['name']);
    }

    // ───── Step 8: Dashboard displays machine and alerts ─────

    public function test_e2e_step8_dashboard_shows_registered_machine(): void
    {
        $this->registerAgent();

        // Send a heartbeat to ensure machine is active
        $heartbeat = [
            'machine_id' => $this->machineId,
            'status' => 'active',
            'agent_version' => '0.1.0',
            'queue_size' => 0,
            'uptime_secs' => 120,
        ];
        $body = json_encode($heartbeat);
        $this->postJson('/api/agents/heartbeat', $heartbeat, $this->signedHeaders($body));

        // Admin accesses machines page
        $response = $this->actingAs($this->admin)->get('/machines');
        $response->assertStatus(200);
    }

    public function test_e2e_step9_dashboard_shows_alerts(): void
    {
        $this->registerAgent();

        // Send event with DLP-triggering content
        $payload = [
            'machine_id' => $this->machineId,
            'events' => [
                [
                    'event_type' => 'prompt',
                    'platform' => 'chatgpt',
                    'domain' => 'api.openai.com',
                    'prompt_excerpt' => 'Voici ma clé Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
                    'severity' => 'info',
                    'occurred_at' => now()->toISOString(),
                ],
            ],
        ];
        $body = json_encode($payload);
        $this->postJson('/api/events', $payload, $this->signedHeaders($body));

        // Verify alert exists
        $this->assertTrue(Alert::where('machine_id', $this->machineId)->exists());

        // Admin accesses alerts page
        $response = $this->actingAs($this->admin)->get('/alerts');
        $response->assertStatus(200);
    }

    public function test_e2e_step10_admin_acknowledges_alert(): void
    {
        $this->registerAgent();

        // Create event + alert via the pipeline
        $payload = [
            'machine_id' => $this->machineId,
            'events' => [
                [
                    'event_type' => 'block',
                    'platform' => 'chatgpt',
                    'domain' => 'api.openai.com',
                    'prompt_excerpt' => 'password = MonMotDePasse123',
                    'severity' => 'warning',
                    'occurred_at' => now()->toISOString(),
                ],
            ],
        ];
        $body = json_encode($payload);
        $this->postJson('/api/events', $payload, $this->signedHeaders($body));

        $alert = Alert::where('machine_id', $this->machineId)->first();
        $this->assertNotNull($alert);
        $this->assertEquals('open', $alert->status);

        // Admin acknowledges the alert
        $response = $this->actingAs($this->admin)
            ->post("/alerts/{$alert->id}/acknowledge");

        $response->assertStatus(302); // redirect back

        $alert->refresh();
        $this->assertEquals('acknowledged', $alert->status);
        $this->assertEquals($this->admin->id, $alert->acknowledged_by);
        $this->assertNotNull($alert->acknowledged_at);
    }

    // ───── Step 11: Full lifecycle in a single test ─────

    public function test_e2e_full_lifecycle(): void
    {
        // 1. Register
        $regResponse = $this->postJson('/api/agents/register', [
            'hostname' => 'LIFECYCLE-PC',
            'os' => 'macos',
            'os_version' => '14.4',
            'agent_version' => '0.1.0',
        ]);
        $regResponse->assertStatus(201);
        $this->apiKey = $regResponse->json('api_key');
        $this->machineId = $regResponse->json('machine_id');
        $this->hmacSecret = $regResponse->json('hmac_secret');

        // 2. Heartbeat
        $hbPayload = [
            'machine_id' => $this->machineId,
            'status' => 'active',
            'agent_version' => '0.1.0',
            'queue_size' => 10,
            'uptime_secs' => 60,
        ];
        $hbBody = json_encode($hbPayload);
        $this->postJson('/api/agents/heartbeat', $hbPayload, $this->signedHeaders($hbBody))
            ->assertStatus(200);

        // 3. Sync rules (should be empty initially)
        $this->withHeaders(['X-Api-Key' => $this->apiKey])
            ->getJson('/api/rules/sync?version=0')
            ->assertStatus(200)
            ->assertJson(['rules' => [], 'deleted_ids' => []]);

        // 4. Send normal events
        $normalPayload = [
            'machine_id' => $this->machineId,
            'events' => [
                [
                    'event_type' => 'prompt',
                    'platform' => 'chatgpt',
                    'domain' => 'api.openai.com',
                    'prompt_excerpt' => 'Bonjour, explique-moi la photosynthèse',
                    'severity' => 'info',
                    'occurred_at' => now()->toISOString(),
                ],
            ],
        ];
        $normalBody = json_encode($normalPayload);
        $this->postJson('/api/events', $normalPayload, $this->signedHeaders($normalBody))
            ->assertStatus(202)
            ->assertJson(['accepted' => 1]);

        $this->assertDatabaseHas('events', [
            'machine_id' => $this->machineId,
            'event_type' => 'prompt',
            'severity' => 'info',
        ]);
        $this->assertEquals(0, Alert::where('machine_id', $this->machineId)->count());

        // 5. Send event with sensitive content (DLP: credentials)
        $sensitivePayload = [
            'machine_id' => $this->machineId,
            'events' => [
                [
                    'event_type' => 'prompt',
                    'platform' => 'claude',
                    'domain' => 'api.anthropic.com',
                    'prompt_excerpt' => 'Corrige ce code avec api_key = sk-proj1234567890abcdefghijklmnop',
                    'severity' => 'info',
                    'occurred_at' => now()->toISOString(),
                ],
            ],
        ];
        $sensitiveBody = json_encode($sensitivePayload);
        $this->postJson('/api/events', $sensitivePayload, $this->signedHeaders($sensitiveBody))
            ->assertStatus(202);

        // DLP should have escalated severity to critical
        $sensitiveEvent = Event::where('machine_id', $this->machineId)
            ->where('platform', 'claude')
            ->first();
        $this->assertEquals('critical', $sensitiveEvent->severity);
        $this->assertArrayHasKey('dlp_matches', $sensitiveEvent->metadata);

        // Alert generated
        $alert = Alert::where('event_id', $sensitiveEvent->id)->first();
        $this->assertNotNull($alert);
        $this->assertEquals('critical', $alert->severity);
        $this->assertEquals('open', $alert->status);

        // 6. Admin views dashboard
        $this->actingAs($this->admin)->get('/')->assertStatus(200);
        $this->actingAs($this->admin)->get('/machines')->assertStatus(200);
        $this->actingAs($this->admin)->get('/alerts')->assertStatus(200);

        // 7. Admin acknowledges alert
        $this->actingAs($this->admin)
            ->post("/alerts/{$alert->id}/acknowledge")
            ->assertStatus(302);

        $alert->refresh();
        $this->assertEquals('acknowledged', $alert->status);

        // 8. Admin resolves alert
        $this->actingAs($this->admin)
            ->post("/alerts/{$alert->id}/resolve")
            ->assertStatus(302);

        $alert->refresh();
        $this->assertEquals('resolved', $alert->status);

        // 9. Final state verification
        $machine = Machine::find($this->machineId);
        $this->assertEquals('active', $machine->status);
        $this->assertEquals(2, Event::where('machine_id', $this->machineId)->count());
        $this->assertEquals(1, Alert::where('machine_id', $this->machineId)->count());
    }

    // ───── Helpers ─────

    /**
     * Register an agent and store the API key and machine ID for subsequent requests.
     */
    private function registerAgent(): void
    {
        $response = $this->postJson('/api/agents/register', [
            'hostname' => 'E2E-TEST-MACHINE',
            'os' => 'windows',
            'os_version' => '11.0.22631',
            'agent_version' => '0.1.0',
        ]);

        $data = $response->json();
        $this->apiKey = $data['api_key'];
        $this->machineId = $data['machine_id'];
        $this->hmacSecret = $data['hmac_secret'];
    }
}
