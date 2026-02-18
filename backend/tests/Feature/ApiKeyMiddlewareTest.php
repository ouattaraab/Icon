<?php

namespace Tests\Feature;

use App\Models\Machine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class ApiKeyMiddlewareTest extends TestCase
{
    use RefreshDatabase;

    private string $apiKey;

    private string $hmacSecret;

    private Machine $machine;

    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();

        $this->apiKey = Str::random(64);
        $this->hmacSecret = Str::random(64);

        $this->machine = Machine::create([
            'hostname' => 'API-KEY-TEST-PC',
            'os' => 'windows',
            'os_version' => '11.0',
            'agent_version' => '0.1.0',
            'api_key_hash' => Hash::make($this->apiKey),
            'api_key_prefix' => substr($this->apiKey, 0, 16),
            'hmac_secret_encrypted' => Crypt::encryptString($this->hmacSecret),
            'status' => 'active',
            'last_heartbeat' => now(),
        ]);

        // Disable HMAC so we can test API key middleware independently
        config(['icon.security.verify_signatures' => false]);
    }

    private function heartbeatPayload(): array
    {
        return [
            'machine_id' => $this->machine->id,
            'status' => 'active',
            'agent_version' => '0.1.0',
            'queue_size' => 0,
            'uptime_secs' => 60,
        ];
    }

    // ── Valid API Key ───────────────────────────────────────────────────

    public function test_valid_api_key_passes(): void
    {
        $this->withHeaders(['X-Api-Key' => $this->apiKey])
            ->postJson('/api/agents/heartbeat', $this->heartbeatPayload())
            ->assertOk();
    }

    public function test_valid_api_key_passes_for_get_routes(): void
    {
        $this->withHeaders(['X-Api-Key' => $this->apiKey])
            ->getJson('/api/rules/sync?version=0')
            ->assertOk();
    }

    public function test_valid_api_key_attaches_machine_to_request(): void
    {
        // The middleware attaches 'authenticated_machine' to the request.
        // The heartbeat controller uses it to update the machine.
        $this->withHeaders(['X-Api-Key' => $this->apiKey])
            ->postJson('/api/agents/heartbeat', $this->heartbeatPayload())
            ->assertOk();

        // If machine was correctly attached, the heartbeat would have updated it
        $this->machine->refresh();
        $this->assertEquals('active', $this->machine->status);
    }

    // ── Invalid API Key ─────────────────────────────────────────────────

    public function test_invalid_api_key_returns_401(): void
    {
        $fakeKey = Str::random(64);

        $this->withHeaders(['X-Api-Key' => $fakeKey])
            ->postJson('/api/agents/heartbeat', $this->heartbeatPayload())
            ->assertStatus(401)
            ->assertJson(['error' => 'Invalid API key']);
    }

    public function test_invalid_api_key_with_matching_prefix_returns_401(): void
    {
        // Use the same prefix but different full key
        $prefix = substr($this->apiKey, 0, 16);
        $fakeKey = $prefix . Str::random(48);

        $this->withHeaders(['X-Api-Key' => $fakeKey])
            ->postJson('/api/agents/heartbeat', $this->heartbeatPayload())
            ->assertStatus(401)
            ->assertJson(['error' => 'Invalid API key']);
    }

    // ── Missing API Key ─────────────────────────────────────────────────

    public function test_missing_api_key_returns_401(): void
    {
        $this->postJson('/api/agents/heartbeat', $this->heartbeatPayload())
            ->assertStatus(401)
            ->assertJson(['error' => 'Missing API key']);
    }

    public function test_empty_api_key_returns_401(): void
    {
        $this->withHeaders(['X-Api-Key' => ''])
            ->postJson('/api/agents/heartbeat', $this->heartbeatPayload())
            ->assertStatus(401)
            ->assertJson(['error' => 'Missing API key']);
    }

    public function test_too_short_api_key_returns_401(): void
    {
        $this->withHeaders(['X-Api-Key' => 'short'])
            ->postJson('/api/agents/heartbeat', $this->heartbeatPayload())
            ->assertStatus(401)
            ->assertJson(['error' => 'Missing API key']);
    }

    // ── Disabled Machine ────────────────────────────────────────────────

    public function test_disabled_machine_api_key_returns_401(): void
    {
        // Disable the machine
        $this->machine->update(['status' => 'disabled']);
        Cache::flush(); // Clear cached machine lookup

        $this->withHeaders(['X-Api-Key' => $this->apiKey])
            ->postJson('/api/agents/heartbeat', $this->heartbeatPayload())
            ->assertStatus(401)
            ->assertJson(['error' => 'Invalid API key']);
    }

    public function test_disabled_machine_cannot_access_get_routes(): void
    {
        $this->machine->update(['status' => 'disabled']);
        Cache::flush();

        $this->withHeaders(['X-Api-Key' => $this->apiKey])
            ->getJson('/api/rules/sync?version=0')
            ->assertStatus(401);
    }

    // ── Cache Behavior ──────────────────────────────────────────────────

    public function test_api_key_lookup_uses_prefix_cache(): void
    {
        // First request should cache the machine
        $this->withHeaders(['X-Api-Key' => $this->apiKey])
            ->postJson('/api/agents/heartbeat', $this->heartbeatPayload())
            ->assertOk();

        $prefix = substr($this->apiKey, 0, 16);
        $this->assertTrue(Cache::has("agent_key:{$prefix}"));
    }

    public function test_cache_cleared_on_key_mismatch(): void
    {
        $prefix = substr($this->apiKey, 0, 16);

        // Warm the cache with a valid request
        $this->withHeaders(['X-Api-Key' => $this->apiKey])
            ->postJson('/api/agents/heartbeat', $this->heartbeatPayload())
            ->assertOk();

        $this->assertTrue(Cache::has("agent_key:{$prefix}"));

        // Use same prefix but wrong full key
        $wrongKey = $prefix . Str::random(48);
        $this->withHeaders(['X-Api-Key' => $wrongKey])
            ->postJson('/api/agents/heartbeat', $this->heartbeatPayload())
            ->assertStatus(401);

        // Cache should be cleared after mismatch
        $this->assertFalse(Cache::has("agent_key:{$prefix}"));
    }

    // ── Multiple Machines ───────────────────────────────────────────────

    public function test_different_machines_use_different_api_keys(): void
    {
        $otherApiKey = Str::random(64);
        $otherMachine = Machine::create([
            'hostname' => 'OTHER-PC',
            'os' => 'windows',
            'agent_version' => '0.1.0',
            'api_key_hash' => Hash::make($otherApiKey),
            'api_key_prefix' => substr($otherApiKey, 0, 16),
            'hmac_secret_encrypted' => Crypt::encryptString(Str::random(64)),
            'status' => 'active',
            'last_heartbeat' => now(),
        ]);

        // First machine's key works for first machine
        $this->withHeaders(['X-Api-Key' => $this->apiKey])
            ->postJson('/api/agents/heartbeat', $this->heartbeatPayload())
            ->assertOk();

        // Second machine's key works for second machine
        $this->withHeaders(['X-Api-Key' => $otherApiKey])
            ->postJson('/api/agents/heartbeat', [
                'machine_id' => $otherMachine->id,
                'status' => 'active',
                'agent_version' => '0.1.0',
                'queue_size' => 0,
                'uptime_secs' => 60,
            ])
            ->assertOk();
    }
}
