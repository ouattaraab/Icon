<?php

namespace Tests\Feature;

use App\Models\Alert;
use App\Models\Event;
use App\Models\Machine;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DepartmentStatsTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::create([
            'name' => 'Admin', 'email' => 'admin@gs2e.ci',
            'password' => 'password', 'role' => 'admin',
        ]);
    }

    public function test_dashboard_includes_department_stats(): void
    {
        $machine = Machine::create([
            'hostname' => 'DSI-PC', 'os' => 'windows',
            'agent_version' => '0.1.0', 'api_key_hash' => 'h',
            'status' => 'active', 'department' => 'DSI',
        ]);

        Event::create([
            'machine_id' => $machine->id,
            'event_type' => 'prompt',
            'platform' => 'chatgpt',
            'severity' => 'info',
            'occurred_at' => now(),
        ]);

        $response = $this->actingAs($this->admin)->get('/');
        $response->assertOk();

        $page = $response->viewData('page');
        $deptStats = $page['props']['departmentStats'];
        $this->assertNotEmpty($deptStats);
        $this->assertEquals('DSI', $deptStats[0]['department']);
        $this->assertEquals(1, $deptStats[0]['machine_count']);
        $this->assertEquals(1, $deptStats[0]['event_count']);
    }

    public function test_dashboard_excludes_machines_without_department(): void
    {
        Machine::create([
            'hostname' => 'NO-DEPT', 'os' => 'windows',
            'agent_version' => '0.1.0', 'api_key_hash' => 'h',
            'status' => 'active',
        ]);

        $response = $this->actingAs($this->admin)->get('/');
        $page = $response->viewData('page');
        $deptStats = $page['props']['departmentStats'];
        $this->assertEmpty($deptStats);
    }

    public function test_department_stats_counts_blocked_events(): void
    {
        $machine = Machine::create([
            'hostname' => 'FIN-PC', 'os' => 'windows',
            'agent_version' => '0.1.0', 'api_key_hash' => 'h',
            'status' => 'active', 'department' => 'Finance',
        ]);

        Event::create([
            'machine_id' => $machine->id,
            'event_type' => 'block',
            'platform' => 'chatgpt',
            'severity' => 'warning',
            'occurred_at' => now(),
        ]);

        Event::create([
            'machine_id' => $machine->id,
            'event_type' => 'prompt',
            'platform' => 'claude',
            'severity' => 'info',
            'occurred_at' => now(),
        ]);

        $response = $this->actingAs($this->admin)->get('/');
        $page = $response->viewData('page');
        $deptStats = $page['props']['departmentStats'];

        $this->assertEquals(2, $deptStats[0]['event_count']);
        $this->assertEquals(1, $deptStats[0]['blocked_count']);
    }

    public function test_department_stats_counts_open_alerts(): void
    {
        $machine = Machine::create([
            'hostname' => 'DSI-PC', 'os' => 'windows',
            'agent_version' => '0.1.0', 'api_key_hash' => 'h',
            'status' => 'active', 'department' => 'DSI',
        ]);

        Alert::create([
            'machine_id' => $machine->id,
            'severity' => 'critical',
            'title' => 'Test alert',
            'status' => 'open',
        ]);

        Alert::create([
            'machine_id' => $machine->id,
            'severity' => 'warning',
            'title' => 'Resolved',
            'status' => 'resolved',
        ]);

        $response = $this->actingAs($this->admin)->get('/');
        $page = $response->viewData('page');
        $deptStats = $page['props']['departmentStats'];

        $this->assertEquals(1, $deptStats[0]['alert_count']);
    }

    public function test_reports_include_department_stats(): void
    {
        Machine::create([
            'hostname' => 'RH-PC', 'os' => 'macos',
            'agent_version' => '0.1.0', 'api_key_hash' => 'h',
            'status' => 'active', 'department' => 'RH',
        ]);

        $response = $this->actingAs($this->admin)->get('/reports');
        $response->assertOk();

        $page = $response->viewData('page');
        $this->assertArrayHasKey('departmentStats', $page['props']);
    }
}
