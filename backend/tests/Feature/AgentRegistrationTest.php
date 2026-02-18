<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AgentRegistrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_agent_can_register(): void
    {
        $response = $this->postJson('/api/agents/register', [
            'hostname' => 'DESKTOP-GS2E-01',
            'os' => 'windows',
            'os_version' => '11.0.22631',
            'agent_version' => '0.1.0',
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'machine_id',
                'api_key',
                'hmac_secret',
            ]);

        $this->assertDatabaseHas('machines', [
            'hostname' => 'DESKTOP-GS2E-01',
            'os' => 'windows',
            'status' => 'active',
        ]);
    }

    public function test_registration_validates_required_fields(): void
    {
        $response = $this->postJson('/api/agents/register', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['hostname', 'os', 'agent_version']);
    }

    public function test_registration_validates_os_values(): void
    {
        $response = $this->postJson('/api/agents/register', [
            'hostname' => 'test-host',
            'os' => 'linux',
            'agent_version' => '0.1.0',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['os']);
    }

    public function test_registration_creates_audit_log(): void
    {
        $this->postJson('/api/agents/register', [
            'hostname' => 'MAC-GS2E-01',
            'os' => 'macos',
            'agent_version' => '0.1.0',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'machine.registered',
            'target_type' => 'Machine',
        ]);
    }
}
