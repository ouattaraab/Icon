<?php

namespace Tests\Feature;

use App\Models\Machine;
use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class AgentUpdateControllerTest extends TestCase
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
            'hostname' => 'UPDATE-TEST-PC',
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

    // ── No Update Available ─────────────────────────────────────────────

    public function test_returns_no_update_when_version_is_current(): void
    {
        Setting::setValue('agent_current_version', '0.1.0');

        $response = $this->withAgentAuth()
            ->getJson('/api/agents/update?current_version=0.1.0');

        $response->assertOk()
            ->assertJson(['update_available' => false]);
    }

    public function test_returns_no_update_when_agent_is_ahead(): void
    {
        Setting::setValue('agent_current_version', '1.0.0');

        $response = $this->withAgentAuth()
            ->getJson('/api/agents/update?current_version=2.0.0');

        $response->assertOk()
            ->assertJson(['update_available' => false]);
    }

    // ── Update Available ────────────────────────────────────────────────

    public function test_returns_update_info_when_newer_version_exists(): void
    {
        Setting::setValue('agent_current_version', '2.0.0');
        Setting::setValue('agent_update_url', 'https://example.com/agent-v2.exe');

        $response = $this->withAgentAuth()
            ->getJson('/api/agents/update?current_version=0.1.0');

        $response->assertOk()
            ->assertJson([
                'update_available' => true,
                'version' => '2.0.0',
                'download_url' => 'https://example.com/agent-v2.exe',
            ]);
    }

    public function test_returns_correct_structure_when_update_available(): void
    {
        Setting::setValue('agent_current_version', '2.0.0');
        Setting::setValue('agent_update_url', 'https://example.com/agent-v2.exe');

        $response = $this->withAgentAuth()
            ->getJson('/api/agents/update?current_version=0.1.0');

        $response->assertOk()
            ->assertJsonStructure([
                'update_available',
                'version',
                'download_url',
                'verify_signature',
                'changelog',
            ]);
    }

    public function test_returns_null_download_url_when_not_configured(): void
    {
        Setting::setValue('agent_current_version', '2.0.0');
        // No agent_update_url set

        $response = $this->withAgentAuth()
            ->getJson('/api/agents/update?current_version=0.1.0');

        $response->assertOk()
            ->assertJson([
                'update_available' => true,
                'version' => '2.0.0',
                'download_url' => null,
            ]);
    }

    // ── Validation Errors ───────────────────────────────────────────────

    public function test_validates_required_current_version(): void
    {
        $this->withAgentAuth()
            ->getJson('/api/agents/update')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['current_version']);
    }

    // ── Authentication ──────────────────────────────────────────────────

    public function test_requires_authentication(): void
    {
        config(['icon.security.verify_signatures' => false]);

        $this->getJson('/api/agents/update?current_version=0.1.0')
            ->assertStatus(401);
    }

    public function test_rejects_invalid_api_key(): void
    {
        config(['icon.security.verify_signatures' => false]);

        $this->withHeaders(['X-Api-Key' => Str::random(64)])
            ->getJson('/api/agents/update?current_version=0.1.0')
            ->assertStatus(401);
    }
}
