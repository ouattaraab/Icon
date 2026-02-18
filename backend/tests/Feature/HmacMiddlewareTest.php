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

    /**
     * Compute an HMAC signature using the {timestamp}.{body} format.
     */
    private function signPayload(string $body, string $secret, ?string $timestamp = null): array
    {
        $timestamp = $timestamp ?? (string) time();
        $signedPayload = $timestamp . '.' . $body;
        $signature = hash_hmac('sha256', $signedPayload, $secret);

        return [$signature, $timestamp];
    }

    // ── Valid Signature ─────────────────────────────────────────────────

    public function test_valid_hmac_signature_passes(): void
    {
        $payload = json_encode($this->heartbeatPayload());
        [$signature, $timestamp] = $this->signPayload($payload, $this->hmacSecret);

        $response = $this->call('POST', '/api/agents/heartbeat', [], [], [], [
            'HTTP_X-Api-Key' => $this->apiKey,
            'HTTP_X-Signature' => $signature,
            'HTTP_X-Timestamp' => $timestamp,
            'CONTENT_TYPE' => 'application/json',
        ], $payload);

        $response->assertOk();
    }

    // ── Invalid Signature ───────────────────────────────────────────────

    public function test_invalid_hmac_signature_returns_401(): void
    {
        $timestamp = (string) time();

        $this->postJson('/api/agents/heartbeat', $this->heartbeatPayload(), [
            'X-Api-Key' => $this->apiKey,
            'X-Signature' => 'totally-invalid-signature',
            'X-Timestamp' => $timestamp,
        ])
            ->assertStatus(401)
            ->assertJson(['error' => 'Invalid HMAC signature']);
    }

    public function test_tampered_payload_returns_401(): void
    {
        $originalPayload = $this->heartbeatPayload();
        $body = json_encode($originalPayload);
        [$signature, $timestamp] = $this->signPayload($body, $this->hmacSecret);

        // Tamper with the payload after signing
        $tamperedPayload = $originalPayload;
        $tamperedPayload['status'] = 'tampered';

        $this->postJson('/api/agents/heartbeat', $tamperedPayload, [
            'X-Api-Key' => $this->apiKey,
            'X-Signature' => $signature,
            'X-Timestamp' => $timestamp,
        ])
            ->assertStatus(401)
            ->assertJson(['error' => 'Invalid HMAC signature']);
    }

    // ── Missing Headers ─────────────────────────────────────────────────

    public function test_missing_signature_header_returns_401(): void
    {
        $timestamp = (string) time();

        $this->postJson('/api/agents/heartbeat', $this->heartbeatPayload(), [
            'X-Api-Key' => $this->apiKey,
            'X-Timestamp' => $timestamp,
            // No X-Signature header
        ])
            ->assertStatus(401)
            ->assertJson(['error' => 'Missing HMAC signature']);
    }

    public function test_missing_api_key_header_returns_401(): void
    {
        $payload = json_encode($this->heartbeatPayload());
        [$signature, $timestamp] = $this->signPayload($payload, $this->hmacSecret);

        // Only X-Signature + X-Timestamp, no X-Api-Key
        $this->postJson('/api/agents/heartbeat', $this->heartbeatPayload(), [
            'X-Signature' => $signature,
            'X-Timestamp' => $timestamp,
        ])
            ->assertStatus(401);
    }

    // ── Timestamp Validation ────────────────────────────────────────────

    public function test_missing_timestamp_returns_401(): void
    {
        $payload = json_encode($this->heartbeatPayload());
        // Sign with a timestamp but do NOT send the X-Timestamp header
        $signature = hash_hmac('sha256', time() . '.' . $payload, $this->hmacSecret);

        $this->call('POST', '/api/agents/heartbeat', [], [], [], [
            'HTTP_X-Api-Key' => $this->apiKey,
            'HTTP_X-Signature' => $signature,
            // No X-Timestamp header
            'CONTENT_TYPE' => 'application/json',
        ], $payload)
            ->assertStatus(401)
            ->assertJson(['error' => 'Missing timestamp']);
    }

    public function test_expired_timestamp_returns_401(): void
    {
        // Use a timestamp that is older than the max age (default 300 seconds)
        $expiredTimestamp = (string) (time() - 600);
        $payload = json_encode($this->heartbeatPayload());
        [$signature] = $this->signPayload($payload, $this->hmacSecret, $expiredTimestamp);

        $this->call('POST', '/api/agents/heartbeat', [], [], [], [
            'HTTP_X-Api-Key' => $this->apiKey,
            'HTTP_X-Signature' => $signature,
            'HTTP_X-Timestamp' => $expiredTimestamp,
            'CONTENT_TYPE' => 'application/json',
        ], $payload)
            ->assertStatus(401)
            ->assertJson(['error' => 'Request timestamp expired']);
    }

    public function test_future_timestamp_returns_401(): void
    {
        // Use a timestamp that is too far in the future (>300 seconds ahead)
        $futureTimestamp = (string) (time() + 600);
        $payload = json_encode($this->heartbeatPayload());
        [$signature] = $this->signPayload($payload, $this->hmacSecret, $futureTimestamp);

        $this->call('POST', '/api/agents/heartbeat', [], [], [], [
            'HTTP_X-Api-Key' => $this->apiKey,
            'HTTP_X-Signature' => $signature,
            'HTTP_X-Timestamp' => $futureTimestamp,
            'CONTENT_TYPE' => 'application/json',
        ], $payload)
            ->assertStatus(401)
            ->assertJson(['error' => 'Request timestamp expired']);
    }

    // ── HMAC Secret Usage ───────────────────────────────────────────────

    public function test_hmac_uses_correct_machine_secret(): void
    {
        $payload = json_encode($this->heartbeatPayload());
        $timestamp = (string) time();

        // Sign with a different secret (wrong secret)
        $wrongSecret = Str::random(64);
        $wrongSignature = hash_hmac('sha256', $timestamp . '.' . $payload, $wrongSecret);

        $this->call('POST', '/api/agents/heartbeat', [], [], [], [
            'HTTP_X-Api-Key' => $this->apiKey,
            'HTTP_X-Signature' => $wrongSignature,
            'HTTP_X-Timestamp' => $timestamp,
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
        [$signature, $timestamp] = $this->signPayload($payload, $globalSecret);

        $response = $this->call('POST', '/api/agents/heartbeat', [], [], [], [
            'HTTP_X-Api-Key' => $apiKeyNoHmac,
            'HTTP_X-Signature' => $signature,
            'HTTP_X-Timestamp' => $timestamp,
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

    // ── Signature bound to timestamp ────────────────────────────────────

    public function test_signature_with_wrong_timestamp_returns_401(): void
    {
        $payload = json_encode($this->heartbeatPayload());
        $timestamp1 = (string) time();
        $timestamp2 = (string) (time() - 10); // A different but still valid timestamp

        // Sign with timestamp1 but send timestamp2
        [$signature] = $this->signPayload($payload, $this->hmacSecret, $timestamp1);

        $this->call('POST', '/api/agents/heartbeat', [], [], [], [
            'HTTP_X-Api-Key' => $this->apiKey,
            'HTTP_X-Signature' => $signature,
            'HTTP_X-Timestamp' => $timestamp2,
            'CONTENT_TYPE' => 'application/json',
        ], $payload)
            ->assertStatus(401)
            ->assertJson(['error' => 'Invalid HMAC signature']);
    }
}
