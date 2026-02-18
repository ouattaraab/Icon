<?php

namespace Tests\Feature;

use App\Models\Machine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class HmacMiddlewareTest extends TestCase
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
            'hostname' => 'HMAC-TEST-PC',
            'os' => 'windows',
            'os_version' => '11.0',
            'agent_version' => '0.1.0',
            'api_key_hash' => Hash::make($this->apiKey),
            'api_key_prefix' => substr($this->apiKey, 0, 16),
            'hmac_secret_encrypted' => Crypt::encryptString($this->hmacSecret),
            'status' => 'active',
            'last_heartbeat' => now(),
        ]);

        // Enable HMAC verification for these tests
        config(['icon.security.verify_signatures' => true]);
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

    // ── Valid Signature ─────────────────────────────────────────────────

    public function test_valid_hmac_signature_passes(): void
    {
        $payload = json_encode($this->heartbeatPayload());
        $signature = hash_hmac('sha256', $payload, $this->hmacSecret);

        $response = $this->call('POST', '/api/agents/heartbeat', [], [], [], [
            'HTTP_X-Api-Key' => $this->apiKey,
            'HTTP_X-Signature' => $signature,
            'CONTENT_TYPE' => 'application/json',
        ], $payload);

        $response->assertOk();
    }

    // ── Invalid Signature ───────────────────────────────────────────────

    public function test_invalid_hmac_signature_returns_401(): void
    {
        $this->postJson('/api/agents/heartbeat', $this->heartbeatPayload(), [
            'X-Api-Key' => $this->apiKey,
            'X-Signature' => 'totally-invalid-signature',
        ])
            ->assertStatus(401)
            ->assertJson(['error' => 'Invalid HMAC signature']);
    }

    public function test_tampered_payload_returns_401(): void
    {
        $originalPayload = $this->heartbeatPayload();
        $signature = hash_hmac('sha256', json_encode($originalPayload), $this->hmacSecret);

        // Tamper with the payload after signing
        $tamperedPayload = $originalPayload;
        $tamperedPayload['status'] = 'tampered';

        $this->postJson('/api/agents/heartbeat', $tamperedPayload, [
            'X-Api-Key' => $this->apiKey,
            'X-Signature' => $signature,
        ])
            ->assertStatus(401)
            ->assertJson(['error' => 'Invalid HMAC signature']);
    }

    // ── Missing Headers ─────────────────────────────────────────────────

    public function test_missing_signature_header_returns_401(): void
    {
        $this->postJson('/api/agents/heartbeat', $this->heartbeatPayload(), [
            'X-Api-Key' => $this->apiKey,
            // No X-Signature header
        ])
            ->assertStatus(401)
            ->assertJson(['error' => 'Missing HMAC signature']);
    }

    public function test_missing_api_key_header_returns_401(): void
    {
        $payload = json_encode($this->heartbeatPayload());
        $signature = hash_hmac('sha256', $payload, $this->hmacSecret);

        // Only X-Signature, no X-Api-Key
        $this->postJson('/api/agents/heartbeat', $this->heartbeatPayload(), [
            'X-Signature' => $signature,
        ])
            ->assertStatus(401);
    }

    // ── HMAC Secret Usage ───────────────────────────────────────────────

    public function test_hmac_uses_correct_machine_secret(): void
    {
        $payload = json_encode($this->heartbeatPayload());

        // Sign with a different secret (wrong secret)
        $wrongSecret = Str::random(64);
        $wrongSignature = hash_hmac('sha256', $payload, $wrongSecret);

        $this->call('POST', '/api/agents/heartbeat', [], [], [], [
            'HTTP_X-Api-Key' => $this->apiKey,
            'HTTP_X-Signature' => $wrongSignature,
            'CONTENT_TYPE' => 'application/json',
        ], $payload)
            ->assertStatus(401)
            ->assertJson(['error' => 'Invalid HMAC signature']);
    }

    public function test_hmac_falls_back_to_global_secret_when_machine_has_none(): void
    {
        $globalSecret = 'global-hmac-secret';
        config(['icon.security.hmac_secret' => $globalSecret]);

        // Create a machine without per-machine HMAC secret
        $apiKeyNoHmac = Str::random(64);
        Machine::create([
            'hostname' => 'NO-HMAC-PC',
            'os' => 'windows',
            'agent_version' => '0.1.0',
            'api_key_hash' => Hash::make($apiKeyNoHmac),
            'api_key_prefix' => substr($apiKeyNoHmac, 0, 16),
            'hmac_secret_encrypted' => null,
            'status' => 'active',
            'last_heartbeat' => now(),
        ]);

        $payload = json_encode([
            'machine_id' => $this->machine->id,
            'status' => 'active',
            'agent_version' => '0.1.0',
            'queue_size' => 0,
            'uptime_secs' => 60,
        ]);
        $signature = hash_hmac('sha256', $payload, $globalSecret);

        $response = $this->call('POST', '/api/agents/heartbeat', [], [], [], [
            'HTTP_X-Api-Key' => $apiKeyNoHmac,
            'HTTP_X-Signature' => $signature,
            'CONTENT_TYPE' => 'application/json',
        ], $payload);

        $response->assertOk();
    }

    // ── GET Requests ────────────────────────────────────────────────────

    public function test_hmac_skipped_for_get_requests(): void
    {
        // GET requests should not require HMAC signature
        $this->withHeaders(['X-Api-Key' => $this->apiKey])
            ->getJson('/api/rules/sync?version=0')
            ->assertOk();
    }

    public function test_hmac_skipped_for_get_even_without_signature(): void
    {
        // GET requests should pass even without X-Signature header
        $this->withHeaders([
            'X-Api-Key' => $this->apiKey,
        ])
            ->getJson('/api/domains/sync')
            ->assertOk();
    }

    // ── Config Bypass ───────────────────────────────────────────────────

    public function test_hmac_verification_bypassed_when_disabled(): void
    {
        config(['icon.security.verify_signatures' => false]);

        // POST without any signature should succeed when verification is disabled
        $this->withHeaders(['X-Api-Key' => $this->apiKey])
            ->postJson('/api/agents/heartbeat', $this->heartbeatPayload())
            ->assertOk();
    }
}
