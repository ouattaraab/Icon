<?php

namespace Tests\Feature;

use App\Models\Machine;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BulkMachineActionTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $manager;
    private User $viewer;
    private array $machines;

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

        $this->machines = [];
        for ($i = 1; $i <= 3; $i++) {
            $this->machines[] = Machine::create([
                'hostname' => "BULK-PC-0{$i}",
                'os' => 'windows',
                'agent_version' => '0.1.0',
                'api_key_hash' => "hash{$i}",
                'status' => 'active',
            ]);
        }
    }

    public function test_admin_can_bulk_force_sync(): void
    {
        $ids = array_map(fn ($m) => $m->id, $this->machines);

        $this->actingAs($this->admin)
            ->post('/machines/bulk-action', [
                'machine_ids' => $ids,
                'action' => 'force_sync',
            ])
            ->assertRedirect();

        foreach ($this->machines as $machine) {
            $commands = cache()->get("machine:{$machine->id}:commands", []);
            $this->assertCount(1, $commands);
            $this->assertEquals('force_sync_rules', $commands[0]['type']);
        }
    }

    public function test_manager_can_bulk_restart(): void
    {
        $ids = array_map(fn ($m) => $m->id, $this->machines);

        $this->actingAs($this->manager)
            ->post('/machines/bulk-action', [
                'machine_ids' => $ids,
                'action' => 'restart',
            ])
            ->assertRedirect();

        foreach ($this->machines as $machine) {
            $commands = cache()->get("machine:{$machine->id}:commands", []);
            $this->assertCount(1, $commands);
            $this->assertEquals('restart', $commands[0]['type']);
        }
    }

    public function test_viewer_cannot_bulk_action(): void
    {
        $ids = array_map(fn ($m) => $m->id, $this->machines);

        $this->actingAs($this->viewer)
            ->post('/machines/bulk-action', [
                'machine_ids' => $ids,
                'action' => 'force_sync',
            ])
            ->assertStatus(403);
    }

    public function test_bulk_disable(): void
    {
        $ids = array_map(fn ($m) => $m->id, $this->machines);

        $this->actingAs($this->admin)
            ->post('/machines/bulk-action', [
                'machine_ids' => $ids,
                'action' => 'disable',
            ])
            ->assertRedirect();

        foreach ($this->machines as $machine) {
            $machine->refresh();
            $this->assertEquals('inactive', $machine->status);
        }
    }

    public function test_bulk_disable_skips_already_inactive(): void
    {
        $this->machines[0]->update(['status' => 'inactive']);
        $ids = array_map(fn ($m) => $m->id, $this->machines);

        $this->actingAs($this->admin)
            ->post('/machines/bulk-action', [
                'machine_ids' => $ids,
                'action' => 'disable',
            ])
            ->assertRedirect();

        // Only 2 audit logs for status change (not 3)
        $this->assertDatabaseCount('audit_logs', 2);
    }

    public function test_bulk_action_creates_audit_logs(): void
    {
        $ids = array_map(fn ($m) => $m->id, $this->machines);

        $this->actingAs($this->admin)
            ->post('/machines/bulk-action', [
                'machine_ids' => $ids,
                'action' => 'force_sync',
            ]);

        $this->assertDatabaseCount('audit_logs', 3);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'machine.force_sync',
            'target_id' => $this->machines[0]->id,
        ]);
    }

    public function test_bulk_action_validates_action(): void
    {
        $this->actingAs($this->admin)
            ->post('/machines/bulk-action', [
                'machine_ids' => [$this->machines[0]->id],
                'action' => 'invalid_action',
            ])
            ->assertSessionHasErrors('action');
    }

    public function test_bulk_action_requires_machine_ids(): void
    {
        $this->actingAs($this->admin)
            ->post('/machines/bulk-action', [
                'machine_ids' => [],
                'action' => 'force_sync',
            ])
            ->assertSessionHasErrors('machine_ids');
    }

    public function test_bulk_action_validates_machine_ids_exist(): void
    {
        $this->actingAs($this->admin)
            ->post('/machines/bulk-action', [
                'machine_ids' => ['00000000-0000-0000-0000-000000000000'],
                'action' => 'force_sync',
            ])
            ->assertSessionHasErrors('machine_ids.0');
    }
}
