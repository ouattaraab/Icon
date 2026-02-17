<?php

namespace Tests\Feature;

use App\Models\Machine;
use App\Models\Tag;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TagTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $manager;
    private User $viewer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::create([
            'name' => 'Admin', 'email' => 'admin@gs2e.ci',
            'password' => 'password', 'role' => 'admin',
        ]);
        $this->manager = User::create([
            'name' => 'Manager', 'email' => 'manager@gs2e.ci',
            'password' => 'password', 'role' => 'manager',
        ]);
        $this->viewer = User::create([
            'name' => 'Viewer', 'email' => 'viewer@gs2e.ci',
            'password' => 'password', 'role' => 'viewer',
        ]);
    }

    public function test_list_tags(): void
    {
        Tag::create(['name' => 'DSI', 'color' => '#3b82f6']);
        Tag::create(['name' => 'Finance', 'color' => '#22c55e']);

        $this->actingAs($this->viewer)
            ->getJson('/tags')
            ->assertOk()
            ->assertJsonCount(2);
    }

    public function test_create_tag(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/tags', ['name' => 'Marketing', 'color' => '#f59e0b'])
            ->assertCreated()
            ->assertJsonFragment(['name' => 'Marketing']);

        $this->assertDatabaseHas('tags', ['name' => 'Marketing']);
    }

    public function test_viewer_cannot_create_tag(): void
    {
        $this->actingAs($this->viewer)
            ->postJson('/tags', ['name' => 'Test', 'color' => '#ff0000'])
            ->assertForbidden();
    }

    public function test_create_tag_validates_name(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/tags', ['name' => '', 'color' => '#ff0000'])
            ->assertUnprocessable();
    }

    public function test_create_tag_validates_color(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/tags', ['name' => 'Test', 'color' => 'red'])
            ->assertUnprocessable();
    }

    public function test_create_tag_unique_name(): void
    {
        Tag::create(['name' => 'DSI', 'color' => '#3b82f6']);

        $this->actingAs($this->admin)
            ->postJson('/tags', ['name' => 'DSI', 'color' => '#ff0000'])
            ->assertUnprocessable();
    }

    public function test_update_tag(): void
    {
        $tag = Tag::create(['name' => 'DSI', 'color' => '#3b82f6']);

        $this->actingAs($this->admin)
            ->putJson("/tags/{$tag->id}", ['name' => 'IT', 'color' => '#ef4444'])
            ->assertOk()
            ->assertJsonFragment(['name' => 'IT']);

        $this->assertDatabaseHas('tags', ['name' => 'IT', 'color' => '#ef4444']);
    }

    public function test_delete_tag(): void
    {
        $tag = Tag::create(['name' => 'Temp', 'color' => '#3b82f6']);

        $this->actingAs($this->admin)
            ->deleteJson("/tags/{$tag->id}")
            ->assertOk();

        $this->assertDatabaseMissing('tags', ['name' => 'Temp']);
    }

    public function test_assign_tags_to_machine(): void
    {
        $machine = Machine::create([
            'hostname' => 'TAG-PC', 'os' => 'windows',
            'agent_version' => '0.1.0', 'api_key_hash' => 'h', 'status' => 'active',
        ]);

        $t1 = Tag::create(['name' => 'DSI', 'color' => '#3b82f6']);
        $t2 = Tag::create(['name' => 'Finance', 'color' => '#22c55e']);

        $this->actingAs($this->admin)
            ->post("/machines/{$machine->id}/tags", ['tag_ids' => [$t1->id, $t2->id]])
            ->assertRedirect();

        $this->assertCount(2, $machine->fresh()->tags);
    }

    public function test_bulk_assign_tags(): void
    {
        $m1 = Machine::create([
            'hostname' => 'PC-1', 'os' => 'windows',
            'agent_version' => '0.1.0', 'api_key_hash' => 'h1', 'status' => 'active',
        ]);
        $m2 = Machine::create([
            'hostname' => 'PC-2', 'os' => 'macos',
            'agent_version' => '0.1.0', 'api_key_hash' => 'h2', 'status' => 'active',
        ]);

        $tag = Tag::create(['name' => 'DSI', 'color' => '#3b82f6']);

        $this->actingAs($this->admin)
            ->post('/machines/bulk-tags', [
                'machine_ids' => [$m1->id, $m2->id],
                'tag_ids' => [$tag->id],
            ])
            ->assertRedirect();

        $this->assertTrue($m1->fresh()->tags->contains($tag));
        $this->assertTrue($m2->fresh()->tags->contains($tag));
    }

    public function test_filter_machines_by_tag(): void
    {
        $m1 = Machine::create([
            'hostname' => 'DSI-PC', 'os' => 'windows',
            'agent_version' => '0.1.0', 'api_key_hash' => 'h1', 'status' => 'active',
        ]);
        Machine::create([
            'hostname' => 'FIN-PC', 'os' => 'windows',
            'agent_version' => '0.1.0', 'api_key_hash' => 'h2', 'status' => 'active',
        ]);

        $tag = Tag::create(['name' => 'DSI', 'color' => '#3b82f6']);
        $m1->tags()->attach($tag);

        $response = $this->actingAs($this->admin)
            ->get("/machines?tag={$tag->id}");

        $response->assertOk();
        $page = $response->viewData('page');
        $machines = $page['props']['machines']['data'];
        $this->assertCount(1, $machines);
        $this->assertEquals('DSI-PC', $machines[0]['hostname']);
    }

    public function test_machines_index_includes_tags(): void
    {
        $machine = Machine::create([
            'hostname' => 'TAG-PC', 'os' => 'windows',
            'agent_version' => '0.1.0', 'api_key_hash' => 'h', 'status' => 'active',
        ]);
        $tag = Tag::create(['name' => 'DSI', 'color' => '#3b82f6']);
        $machine->tags()->attach($tag);

        $response = $this->actingAs($this->admin)->get('/machines');
        $page = $response->viewData('page');
        $machineData = $page['props']['machines']['data'][0];

        $this->assertArrayHasKey('tags', $machineData);
        $this->assertCount(1, $machineData['tags']);
        $this->assertEquals('DSI', $machineData['tags'][0]['name']);
    }

    public function test_tag_creates_audit_log(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/tags', ['name' => 'Audit', 'color' => '#3b82f6']);

        $this->assertDatabaseHas('audit_logs', ['action' => 'tag.created']);
    }

    public function test_tag_model_has_machines_relationship(): void
    {
        $tag = Tag::create(['name' => 'DSI', 'color' => '#3b82f6']);
        $machine = Machine::create([
            'hostname' => 'REL-PC', 'os' => 'windows',
            'agent_version' => '0.1.0', 'api_key_hash' => 'h', 'status' => 'active',
        ]);

        $tag->machines()->attach($machine);

        $this->assertCount(1, $tag->fresh()->machines);
    }
}
