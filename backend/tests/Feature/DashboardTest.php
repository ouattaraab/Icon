<?php

namespace Tests\Feature;

use App\Models\Alert;
use App\Models\Machine;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::create([
            'name' => 'Admin',
            'email' => 'admin@gs2e.ci',
            'password' => bcrypt('password'),
            'role' => 'admin',
        ]);
    }

    public function test_dashboard_shows_stats(): void
    {
        $response = $this->actingAs($this->admin)->get('/');

        $response->assertStatus(200);
    }

    public function test_machines_page(): void
    {
        Machine::create([
            'hostname' => 'TEST-PC',
            'os' => 'windows',
            'agent_version' => '0.1.0',
            'api_key_hash' => 'hash',
            'status' => 'active',
        ]);

        $response = $this->actingAs($this->admin)->get('/machines');

        $response->assertStatus(200);
    }

    public function test_alerts_page(): void
    {
        $response = $this->actingAs($this->admin)->get('/alerts');

        $response->assertStatus(200);
    }

    public function test_rules_page(): void
    {
        $response = $this->actingAs($this->admin)->get('/rules');

        $response->assertStatus(200);
    }

    public function test_reports_page(): void
    {
        $response = $this->actingAs($this->admin)->get('/reports');

        $response->assertStatus(200);
    }

    public function test_alert_acknowledge(): void
    {
        $machine = Machine::create([
            'hostname' => 'TEST-PC',
            'os' => 'windows',
            'agent_version' => '0.1.0',
            'api_key_hash' => 'hash',
            'status' => 'active',
        ]);

        $alert = Alert::create([
            'machine_id' => $machine->id,
            'severity' => 'critical',
            'title' => 'Test alert',
            'status' => 'open',
        ]);

        $response = $this->actingAs($this->admin)
            ->post("/alerts/{$alert->id}/acknowledge");

        $response->assertRedirect();

        $alert->refresh();
        $this->assertEquals('acknowledged', $alert->status);
        $this->assertEquals($this->admin->id, $alert->acknowledged_by);
    }

    public function test_alert_resolve(): void
    {
        $machine = Machine::create([
            'hostname' => 'TEST-PC',
            'os' => 'windows',
            'agent_version' => '0.1.0',
            'api_key_hash' => 'hash',
            'status' => 'active',
        ]);

        $alert = Alert::create([
            'machine_id' => $machine->id,
            'severity' => 'warning',
            'title' => 'Test alert',
            'status' => 'acknowledged',
        ]);

        $response = $this->actingAs($this->admin)
            ->post("/alerts/{$alert->id}/resolve");

        $response->assertRedirect();

        $alert->refresh();
        $this->assertEquals('resolved', $alert->status);
    }
}
