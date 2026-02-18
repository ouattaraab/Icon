<?php

namespace Tests\Feature;

use App\Models\Machine;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MachineActionTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $manager;

    private User $viewer;

    private Machine $machine;

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

        $this->machine = Machine::create([
            'hostname' => 'TEST-PC-01',
            'os' => 'windows',
            'agent_version' => '0.1.0',
            'api_key_hash' => 'hash',
            'status' => 'active',
        ]);
    }

    // ── Force sync rules ────────────────────────────────────────────────

    public function test_admin_can_force_sync_rules(): void
    {
        $this->actingAs($this->admin)
            ->post("/machines/{$this->machine->id}/force-sync")
            ->assertRedirect();

        $commands = cache()->get("machine:{$this->machine->id}:commands", []);
        $this->assertCount(1, $commands);
        $this->assertEquals('force_sync_rules', $commands[0]['type']);
    }

    public function test_manager_can_force_sync_rules(): void
    {
        $this->actingAs($this->manager)
            ->post("/machines/{$this->machine->id}/force-sync")
            ->assertRedirect();
    }

    public function test_viewer_cannot_force_sync_rules(): void
    {
        $this->actingAs($this->viewer)
            ->post("/machines/{$this->machine->id}/force-sync")
            ->assertStatus(403);
    }

    public function test_force_sync_creates_audit_log(): void
    {
        $this->actingAs($this->admin)
            ->post("/machines/{$this->machine->id}/force-sync");

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'machine.force_sync',
            'target_id' => $this->machine->id,
        ]);
    }

    // ── Restart agent ───────────────────────────────────────────────────

    public function test_admin_can_restart_agent(): void
    {
        $this->actingAs($this->admin)
            ->post("/machines/{$this->machine->id}/restart")
            ->assertRedirect();

        $commands = cache()->get("machine:{$this->machine->id}:commands", []);
        $this->assertCount(1, $commands);
        $this->assertEquals('restart', $commands[0]['type']);
    }

    public function test_viewer_cannot_restart_agent(): void
    {
        $this->actingAs($this->viewer)
            ->post("/machines/{$this->machine->id}/restart")
            ->assertStatus(403);
    }

    public function test_restart_creates_audit_log(): void
    {
        $this->actingAs($this->admin)
            ->post("/machines/{$this->machine->id}/restart");

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'machine.restart',
            'target_id' => $this->machine->id,
        ]);
    }

    // ── Toggle status ───────────────────────────────────────────────────

    public function test_admin_can_disable_machine(): void
    {
        $this->actingAs($this->admin)
            ->post("/machines/{$this->machine->id}/toggle-status")
            ->assertRedirect();

        $this->machine->refresh();
        $this->assertEquals('inactive', $this->machine->status);
    }

    public function test_admin_can_reactivate_machine(): void
    {
        $this->machine->update(['status' => 'inactive']);

        $this->actingAs($this->admin)
            ->post("/machines/{$this->machine->id}/toggle-status")
            ->assertRedirect();

        $this->machine->refresh();
        $this->assertEquals('active', $this->machine->status);
    }

    public function test_viewer_cannot_toggle_status(): void
    {
        $this->actingAs($this->viewer)
            ->post("/machines/{$this->machine->id}/toggle-status")
            ->assertStatus(403);
    }

    public function test_toggle_status_creates_audit_log(): void
    {
        $this->actingAs($this->admin)
            ->post("/machines/{$this->machine->id}/toggle-status");

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'machine.status_changed',
            'target_id' => $this->machine->id,
        ]);
    }

    // ── Multiple commands accumulate ────────────────────────────────────

    public function test_multiple_commands_accumulate(): void
    {
        $this->actingAs($this->admin)
            ->post("/machines/{$this->machine->id}/force-sync");

        $this->actingAs($this->admin)
            ->post("/machines/{$this->machine->id}/restart");

        $commands = cache()->get("machine:{$this->machine->id}:commands", []);
        $this->assertCount(2, $commands);
        $this->assertEquals('force_sync_rules', $commands[0]['type']);
        $this->assertEquals('restart', $commands[1]['type']);
    }

    // ── Update machine info ──────────────────────────────────────────────

    public function test_manager_can_update_machine(): void
    {
        $this->actingAs($this->manager)
            ->put("/machines/{$this->machine->id}", [
                'department' => 'Marketing',
                'assigned_user' => 'Marie Konan',
                'notes' => 'Machine de test',
            ])
            ->assertRedirect();

        $this->machine->refresh();
        $this->assertEquals('Marketing', $this->machine->department);
        $this->assertEquals('Marie Konan', $this->machine->assigned_user);
        $this->assertEquals('Machine de test', $this->machine->notes);
    }

    public function test_viewer_cannot_update_machine(): void
    {
        $this->actingAs($this->viewer)
            ->put("/machines/{$this->machine->id}", [
                'department' => 'Marketing',
            ])
            ->assertStatus(403);
    }

    public function test_update_machine_creates_audit_log(): void
    {
        $this->actingAs($this->admin)
            ->put("/machines/{$this->machine->id}", [
                'department' => 'Finance',
                'assigned_user' => 'Amadou Diallo',
            ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'machine.updated',
            'target_id' => $this->machine->id,
        ]);
    }

    public function test_update_machine_validates_notes_max_length(): void
    {
        $this->actingAs($this->admin)
            ->put("/machines/{$this->machine->id}", [
                'notes' => str_repeat('a', 5001),
            ])
            ->assertSessionHasErrors('notes');
    }
}
