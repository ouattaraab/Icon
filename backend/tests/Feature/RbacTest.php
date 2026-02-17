<?php

namespace Tests\Feature;

use App\Models\Alert;
use App\Models\Machine;
use App\Models\MonitoredDomain;
use App\Models\Rule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RbacTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $manager;
    private User $viewer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::create([
            'name' => 'Admin',
            'email' => 'admin@gs2e.ci',
            'password' => bcrypt('password'),
            'role' => 'admin',
        ]);

        $this->manager = User::create([
            'name' => 'Manager',
            'email' => 'manager@gs2e.ci',
            'password' => bcrypt('password'),
            'role' => 'manager',
        ]);

        $this->viewer = User::create([
            'name' => 'Viewer',
            'email' => 'viewer@gs2e.ci',
            'password' => bcrypt('password'),
            'role' => 'viewer',
        ]);
    }

    // ── Read-only pages: all roles can view ──────────────────────────

    public function test_viewer_can_access_dashboard(): void
    {
        $this->actingAs($this->viewer)->get('/')->assertStatus(200);
    }

    public function test_viewer_can_access_machines(): void
    {
        $this->actingAs($this->viewer)->get('/machines')->assertStatus(200);
    }

    public function test_viewer_can_access_alerts(): void
    {
        $this->actingAs($this->viewer)->get('/alerts')->assertStatus(200);
    }

    public function test_viewer_can_access_rules(): void
    {
        $this->actingAs($this->viewer)->get('/rules')->assertStatus(200);
    }

    public function test_viewer_can_access_domains(): void
    {
        $this->actingAs($this->viewer)->get('/domains')->assertStatus(200);
    }

    public function test_viewer_can_access_reports(): void
    {
        $this->actingAs($this->viewer)->get('/reports')->assertStatus(200);
    }

    public function test_viewer_can_access_audit(): void
    {
        $this->actingAs($this->viewer)->get('/audit')->assertStatus(200);
    }

    // ── Manager actions: viewer blocked, manager/admin allowed ───────

    public function test_viewer_cannot_acknowledge_alert(): void
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

        $this->actingAs($this->viewer)
            ->post("/alerts/{$alert->id}/acknowledge")
            ->assertStatus(403);
    }

    public function test_manager_can_acknowledge_alert(): void
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

        $this->actingAs($this->manager)
            ->post("/alerts/{$alert->id}/acknowledge")
            ->assertRedirect();
    }

    public function test_viewer_cannot_create_rule(): void
    {
        $this->actingAs($this->viewer)
            ->post('/rules', [
                'name' => 'Test Rule',
                'category' => 'log',
                'target' => 'prompt',
                'condition_type' => 'keyword',
                'condition_value' => ['keywords' => ['test']],
                'priority' => 10,
            ])
            ->assertStatus(403);
    }

    public function test_manager_can_create_rule(): void
    {
        $this->actingAs($this->manager)
            ->post('/rules', [
                'name' => 'Test Rule',
                'category' => 'log',
                'target' => 'prompt',
                'condition_type' => 'keyword',
                'condition_value' => ['keywords' => ['test']],
                'priority' => 10,
            ])
            ->assertRedirect();
    }

    public function test_viewer_cannot_create_domain(): void
    {
        $this->actingAs($this->viewer)
            ->post('/domains', [
                'domain' => 'api.openai.com',
                'platform_name' => 'ChatGPT',
            ])
            ->assertStatus(403);
    }

    public function test_manager_can_create_domain(): void
    {
        $this->actingAs($this->manager)
            ->post('/domains', [
                'domain' => 'api.openai.com',
                'platform_name' => 'ChatGPT',
            ])
            ->assertRedirect();
    }

    public function test_viewer_cannot_toggle_domain(): void
    {
        $domain = MonitoredDomain::create([
            'domain' => 'api.openai.com',
            'platform_name' => 'ChatGPT',
            'is_blocked' => false,
        ]);

        $this->actingAs($this->viewer)
            ->post("/domains/{$domain->id}/toggle")
            ->assertStatus(403);
    }

    public function test_viewer_cannot_delete_rule(): void
    {
        $rule = Rule::create([
            'name' => 'Test',
            'category' => 'log',
            'target' => 'prompt',
            'condition_type' => 'keyword',
            'condition_value' => ['keywords' => ['test']],
            'priority' => 0,
            'created_by' => $this->admin->id,
        ]);

        $this->actingAs($this->viewer)
            ->delete("/rules/{$rule->id}")
            ->assertStatus(403);
    }

    // ── Admin-only: user management ──────────────────────────────────

    public function test_viewer_cannot_access_users(): void
    {
        $this->actingAs($this->viewer)
            ->get('/users')
            ->assertStatus(403);
    }

    public function test_manager_cannot_access_users(): void
    {
        $this->actingAs($this->manager)
            ->get('/users')
            ->assertStatus(403);
    }

    public function test_admin_can_access_users(): void
    {
        $this->actingAs($this->admin)
            ->get('/users')
            ->assertStatus(200);
    }

    public function test_admin_can_create_user(): void
    {
        $this->actingAs($this->admin)
            ->post('/users', [
                'name' => 'New User',
                'email' => 'new@gs2e.ci',
                'password' => 'password123',
                'role' => 'viewer',
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('users', [
            'email' => 'new@gs2e.ci',
            'role' => 'viewer',
        ]);
    }

    public function test_admin_can_update_user(): void
    {
        $this->actingAs($this->admin)
            ->put("/users/{$this->viewer->id}", [
                'name' => 'Updated Viewer',
                'email' => 'viewer@gs2e.ci',
                'role' => 'manager',
            ])
            ->assertRedirect();

        $this->viewer->refresh();
        $this->assertEquals('Updated Viewer', $this->viewer->name);
        $this->assertEquals('manager', $this->viewer->role);
    }

    public function test_admin_can_delete_user(): void
    {
        $this->actingAs($this->admin)
            ->delete("/users/{$this->viewer->id}")
            ->assertRedirect();

        $this->assertDatabaseMissing('users', ['id' => $this->viewer->id]);
    }

    public function test_admin_cannot_delete_self(): void
    {
        $this->actingAs($this->admin)
            ->delete("/users/{$this->admin->id}");

        // Admin should still exist
        $this->assertDatabaseHas('users', ['id' => $this->admin->id]);
    }

    public function test_manager_cannot_create_user(): void
    {
        $this->actingAs($this->manager)
            ->post('/users', [
                'name' => 'Attempt',
                'email' => 'attempt@gs2e.ci',
                'password' => 'password123',
                'role' => 'viewer',
            ])
            ->assertStatus(403);
    }

    public function test_manager_cannot_delete_user(): void
    {
        $this->actingAs($this->manager)
            ->delete("/users/{$this->viewer->id}")
            ->assertStatus(403);
    }

    // ── Shared Inertia data ──────────────────────────────────────────

    public function test_inertia_shares_role_flags(): void
    {
        $response = $this->actingAs($this->admin)->get('/');
        $response->assertStatus(200);
        // Admin should have is_admin=true
        $page = $response->original->getData()['page'];
        $this->assertTrue($page['props']['auth']['is_admin']);
        $this->assertTrue($page['props']['auth']['is_manager']);
    }

    public function test_inertia_viewer_flags(): void
    {
        $response = $this->actingAs($this->viewer)->get('/');
        $response->assertStatus(200);
        $page = $response->original->getData()['page'];
        $this->assertFalse($page['props']['auth']['is_admin']);
        $this->assertFalse($page['props']['auth']['is_manager']);
    }
}
