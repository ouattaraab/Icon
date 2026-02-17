<?php

namespace Tests\Feature;

use App\Models\Alert;
use App\Models\Machine;
use App\Models\Rule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SearchSuggestionTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'name' => 'Admin',
            'email' => 'admin@gs2e.ci',
            'password' => bcrypt('password'),
            'role' => 'admin',
        ]);
    }

    public function test_suggestions_require_auth(): void
    {
        $this->getJson('/search/suggestions?q=test')
            ->assertStatus(401);
    }

    public function test_suggestions_return_empty_for_short_query(): void
    {
        $this->actingAs($this->user)
            ->getJson('/search/suggestions?q=a')
            ->assertOk()
            ->assertJson([]);
    }

    public function test_suggestions_return_machines(): void
    {
        Machine::create([
            'hostname' => 'DESKTOP-ALPHA',
            'os' => 'windows',
            'agent_version' => '0.1.0',
            'api_key_hash' => 'hash1',
            'status' => 'active',
        ]);

        $response = $this->actingAs($this->user)
            ->getJson('/search/suggestions?q=ALPHA');

        $response->assertOk();
        $data = $response->json();
        $this->assertNotEmpty($data);
        $this->assertEquals('machine', $data[0]['type']);
        $this->assertEquals('DESKTOP-ALPHA', $data[0]['label']);
    }

    public function test_suggestions_return_alerts(): void
    {
        $machine = Machine::create([
            'hostname' => 'SRV-01',
            'os' => 'windows',
            'agent_version' => '0.1.0',
            'api_key_hash' => 'hash1',
            'status' => 'active',
        ]);

        Alert::create([
            'machine_id' => $machine->id,
            'title' => 'Fuite de données détectée',
            'severity' => 'critical',
            'status' => 'open',
        ]);

        $response = $this->actingAs($this->user)
            ->getJson('/search/suggestions?q=Fuite');

        $response->assertOk();
        $data = $response->json();
        $found = collect($data)->firstWhere('type', 'alert');
        $this->assertNotNull($found);
        $this->assertStringContainsString('Fuite', $found['label']);
    }

    public function test_suggestions_return_rules(): void
    {
        Rule::create([
            'name' => 'Bloquer mots de passe',
            'category' => 'block',
            'target' => 'prompt',
            'condition_type' => 'keyword',
            'condition_value' => ['keywords' => ['password']],
            'enabled' => true,
        ]);

        $response = $this->actingAs($this->user)
            ->getJson('/search/suggestions?q=Bloquer');

        $response->assertOk();
        $data = $response->json();
        $found = collect($data)->firstWhere('type', 'rule');
        $this->assertNotNull($found);
        $this->assertStringContainsString('Bloquer', $found['label']);
    }

    public function test_suggestions_limit_results(): void
    {
        // Create 10 machines matching
        for ($i = 0; $i < 10; $i++) {
            Machine::create([
                'hostname' => "TEST-MACHINE-{$i}",
                'os' => 'windows',
                'agent_version' => '0.1.0',
                'api_key_hash' => "hash{$i}",
                'status' => 'active',
            ]);
        }

        $response = $this->actingAs($this->user)
            ->getJson('/search/suggestions?q=TEST-MACHINE');

        $response->assertOk();
        $data = $response->json();
        $machineResults = collect($data)->where('type', 'machine');
        // Should be limited to 4
        $this->assertLessThanOrEqual(4, $machineResults->count());
    }

    public function test_suggestions_contain_href(): void
    {
        Machine::create([
            'hostname' => 'MY-PC',
            'os' => 'windows',
            'agent_version' => '0.1.0',
            'api_key_hash' => 'hash1',
            'status' => 'active',
        ]);

        $response = $this->actingAs($this->user)
            ->getJson('/search/suggestions?q=MY-PC');

        $data = $response->json();
        $this->assertNotEmpty($data);
        $this->assertStringStartsWith('/machines/', $data[0]['href']);
    }
}
