<?php

namespace Tests\Feature;

use App\Models\AgentDeployment;
use App\Models\Machine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class AgentDeploymentControllerTest extends TestCase
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
            'hostname' => 'DEPLOY-TEST-PC',
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

    private function validDeploymentPayload(array $overrides = []): array
    {
        return array_merge([
            'version' => '1.0.0',
            'previous_version' => '0.1.0',
            'status' => 'success',
            'deployment_method' => 'auto_update',
        ], $overrides);
    }

    // ── Success Cases ───────────────────────────────────────────────────

    public function test_valid_deployment_report_returns_201(): void
    {
        $response = $this->withAgentAuth()
            ->postJson('/api/agents/deployment', $this->validDeploymentPayload());

        $response->assertStatus(201)
            ->assertJson(['received' => true]);

        $this->assertArrayHasKey('id', $response->json());
    }

    public function test_creates_agent_deployment_record_in_database(): void
    {
        $this->withAgentAuth()
            ->postJson('/api/agents/deployment', $this->validDeploymentPayload([
                'version' => '2.0.0',
                'previous_version' => '0.1.0',
                'status' => 'success',
                'deployment_method' => 'manual',
            ]));

        $this->assertDatabaseHas('agent_deployments', [
            'machine_id' => $this->machine->id,
            'version' => '2.0.0',
            'previous_version' => '0.1.0',
            'status' => 'success',
            'deployment_method' => 'manual',
        ]);
    }

    public function test_updates_machine_agent_version_on_success_status(): void
    {
        $this->assertEquals('0.1.0', $this->machine->agent_version);

        $this->withAgentAuth()
            ->postJson('/api/agents/deployment', $this->validDeploymentPayload([
                'version' => '2.0.0',
                'status' => 'success',
            ]));

        $this->machine->refresh();
        $this->assertEquals('2.0.0', $this->machine->agent_version);
    }

    public function test_does_not_update_machine_agent_version_on_failed_status(): void
    {
        $this->assertEquals('0.1.0', $this->machine->agent_version);

        $this->withAgentAuth()
            ->postJson('/api/agents/deployment', $this->validDeploymentPayload([
                'version' => '2.0.0',
                'status' => 'failed',
                'error_message' => 'Installation failed due to permission error.',
            ]));

        $this->machine->refresh();
        $this->assertEquals('0.1.0', $this->machine->agent_version);
    }

    public function test_does_not_update_machine_agent_version_on_pending_status(): void
    {
        $this->withAgentAuth()
            ->postJson('/api/agents/deployment', $this->validDeploymentPayload([
                'version' => '2.0.0',
                'status' => 'pending',
            ]));

        $this->machine->refresh();
        $this->assertEquals('0.1.0', $this->machine->agent_version);
    }

    public function test_does_not_update_machine_agent_version_on_rolled_back_status(): void
    {
        $this->withAgentAuth()
            ->postJson('/api/agents/deployment', $this->validDeploymentPayload([
                'version' => '2.0.0',
                'status' => 'rolled_back',
            ]));

        $this->machine->refresh();
        $this->assertEquals('0.1.0', $this->machine->agent_version);
    }

    public function test_stores_error_message_for_failed_deployment(): void
    {
        $errorMessage = 'Checksum mismatch after download.';

        $this->withAgentAuth()
            ->postJson('/api/agents/deployment', $this->validDeploymentPayload([
                'status' => 'failed',
                'error_message' => $errorMessage,
            ]));

        $this->assertDatabaseHas('agent_deployments', [
            'machine_id' => $this->machine->id,
            'status' => 'failed',
            'error_message' => $errorMessage,
        ]);
    }

    // ── Validation Errors ───────────────────────────────────────────────

    public function test_validates_required_version(): void
    {
        $payload = $this->validDeploymentPayload();
        unset($payload['version']);

        $this->withAgentAuth()
            ->postJson('/api/agents/deployment', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['version']);
    }

    public function test_validates_required_status(): void
    {
        $payload = $this->validDeploymentPayload();
        unset($payload['status']);

        $this->withAgentAuth()
            ->postJson('/api/agents/deployment', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status']);
    }

    public function test_validates_status_enum_values(): void
    {
        $this->withAgentAuth()
            ->postJson('/api/agents/deployment', $this->validDeploymentPayload([
                'status' => 'invalid_status',
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status']);
    }

    public function test_validates_deployment_method_enum_values(): void
    {
        $this->withAgentAuth()
            ->postJson('/api/agents/deployment', $this->validDeploymentPayload([
                'deployment_method' => 'invalid_method',
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['deployment_method']);
    }

    public function test_rejects_missing_all_required_fields(): void
    {
        $this->withAgentAuth()
            ->postJson('/api/agents/deployment', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['version', 'status']);
    }

    // ── Authentication ──────────────────────────────────────────────────

    public function test_requires_authentication(): void
    {
        config(['icon.security.verify_signatures' => false]);

        $this->postJson('/api/agents/deployment', $this->validDeploymentPayload())
            ->assertStatus(401);
    }

    public function test_rejects_invalid_api_key(): void
    {
        config(['icon.security.verify_signatures' => false]);

        $this->withHeaders(['X-Api-Key' => Str::random(64)])
            ->postJson('/api/agents/deployment', $this->validDeploymentPayload())
            ->assertStatus(401);
    }
}
