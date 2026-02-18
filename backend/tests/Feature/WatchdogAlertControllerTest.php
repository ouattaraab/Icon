<?php

namespace Tests\Feature;

use App\Models\Alert;
use App\Models\Machine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class WatchdogAlertControllerTest extends TestCase
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
            'hostname' => 'WATCHDOG-TEST-PC',
            'os' => 'windows',
            'os_version' => '11.0',
            'agent_version' => '0.1.0',
            'api_key_hash' => Hash::make($this->apiKey),
            'api_key_prefix' => substr($this->apiKey, 0, 16),
            'hmac_secret_encrypted' => Crypt::encryptString($this->hmacSecret),
            'status' => 'active',
            'last_heartbeat' => now(),
        ]);
    }

    private function withAgentAuth(): static
    {
        config(['icon.security.verify_signatures' => false]);

        return $this->withHeaders([
            'X-Api-Key' => $this->apiKey,
        ]);
    }

    private function validAlertPayload(array $overrides = []): array
    {
        return array_merge([
            'alert_type' => 'agent_restarted',
            'message' => 'The agent process was restarted by the watchdog.',
            'source' => 'watchdog',
            'agent_version' => '0.1.0',
        ], $overrides);
    }

    // ── Success Cases ───────────────────────────────────────────────────

    public function test_valid_alert_creates_record_and_returns_success(): void
    {
        $response = $this->withAgentAuth()
            ->postJson('/api/agents/watchdog-alert', $this->validAlertPayload());

        $response->assertOk()
            ->assertJson(['received' => true]);

        $this->assertDatabaseHas('alerts', [
            'machine_id' => $this->machine->id,
            'severity' => 'warning',
            'status' => 'open',
        ]);
    }

    public function test_critical_alert_type_sets_critical_severity(): void
    {
        $this->withAgentAuth()
            ->postJson('/api/agents/watchdog-alert', $this->validAlertPayload([
                'alert_type' => 'binary_tampered',
            ]));

        $this->assertDatabaseHas('alerts', [
            'machine_id' => $this->machine->id,
            'severity' => 'critical',
        ]);
    }

    public function test_agent_crash_loop_sets_critical_severity(): void
    {
        $this->withAgentAuth()
            ->postJson('/api/agents/watchdog-alert', $this->validAlertPayload([
                'alert_type' => 'agent_crash_loop',
            ]));

        $this->assertDatabaseHas('alerts', [
            'machine_id' => $this->machine->id,
            'severity' => 'critical',
        ]);
    }

    public function test_alert_stores_formatted_title(): void
    {
        $this->withAgentAuth()
            ->postJson('/api/agents/watchdog-alert', $this->validAlertPayload([
                'alert_type' => 'agent_restarted',
            ]));

        $alert = Alert::where('machine_id', $this->machine->id)->first();
        $this->assertNotNull($alert);
        $this->assertStringContainsString($this->machine->hostname, $alert->title);
    }

    public function test_alert_stores_message_as_description(): void
    {
        $message = 'Custom watchdog alert message for testing.';

        $this->withAgentAuth()
            ->postJson('/api/agents/watchdog-alert', $this->validAlertPayload([
                'message' => $message,
            ]));

        $this->assertDatabaseHas('alerts', [
            'machine_id' => $this->machine->id,
            'description' => $message,
        ]);
    }

    // ── Validation Errors ───────────────────────────────────────────────

    public function test_validates_required_alert_type(): void
    {
        $payload = $this->validAlertPayload();
        unset($payload['alert_type']);

        $this->withAgentAuth()
            ->postJson('/api/agents/watchdog-alert', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['alert_type']);
    }

    public function test_validates_required_message(): void
    {
        $payload = $this->validAlertPayload();
        unset($payload['message']);

        $this->withAgentAuth()
            ->postJson('/api/agents/watchdog-alert', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['message']);
    }

    public function test_validates_required_source(): void
    {
        $payload = $this->validAlertPayload();
        unset($payload['source']);

        $this->withAgentAuth()
            ->postJson('/api/agents/watchdog-alert', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['source']);
    }

    public function test_rejects_missing_all_required_fields(): void
    {
        $this->withAgentAuth()
            ->postJson('/api/agents/watchdog-alert', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['alert_type', 'message', 'source']);
    }

    // ── Authentication ──────────────────────────────────────────────────

    public function test_requires_authentication(): void
    {
        config(['icon.security.verify_signatures' => false]);

        $this->postJson('/api/agents/watchdog-alert', $this->validAlertPayload())
            ->assertStatus(401);
    }

    public function test_rejects_invalid_api_key(): void
    {
        config(['icon.security.verify_signatures' => false]);

        $this->withHeaders(['X-Api-Key' => Str::random(64)])
            ->postJson('/api/agents/watchdog-alert', $this->validAlertPayload())
            ->assertStatus(401);
    }
}
