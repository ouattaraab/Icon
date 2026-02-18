<?php

namespace Tests\Feature;

use App\Models\Machine;
use App\Models\MonitoredDomain;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class DomainSyncControllerTest extends TestCase
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
            'hostname' => 'DOMAIN-SYNC-TEST-PC',
            'os' => 'windows',
            'os_version' => '11.0',
            'agent_version' => '0.1.0',
            'api_key_hash' => Hash::make($this->apiKey),
            'api_key_prefix' => substr($this->apiKey, 0, 16),
            'hmac_secret_encrypted' => Crypt::encryptString($this->hmacSecret),
            'status' => 'active',
            'last_heartbeat' => now(),
        ]);
    }

    private function withAgentAuth(): static
    {
        config(['icon.security.verify_signatures' => false]);

        return $this->withHeaders([
            'X-Api-Key' => $this->apiKey,
        ]);
    }

    // ── Success Cases ───────────────────────────────────────────────────

    public function test_returns_all_monitored_domains(): void
    {
        MonitoredDomain::create([
            'domain' => 'facebook.com',
            'platform_name' => 'Facebook',
            'is_blocked' => true,
        ]);
        MonitoredDomain::create([
            'domain' => 'youtube.com',
            'platform_name' => 'YouTube',
            'is_blocked' => false,
        ]);
        MonitoredDomain::create([
            'domain' => 'twitter.com',
            'platform_name' => 'Twitter',
            'is_blocked' => true,
        ]);

        $response = $this->withAgentAuth()
            ->getJson('/api/domains/sync');

        $response->assertOk();
        $this->assertCount(3, $response->json('domains'));
    }

    public function test_includes_domain_platform_name_and_is_blocked_fields(): void
    {
        MonitoredDomain::create([
            'domain' => 'facebook.com',
            'platform_name' => 'Facebook',
            'is_blocked' => true,
        ]);

        $response = $this->withAgentAuth()
            ->getJson('/api/domains/sync');

        $response->assertOk();

        $domain = $response->json('domains.0');
        $this->assertArrayHasKey('domain', $domain);
        $this->assertArrayHasKey('platform_name', $domain);
        $this->assertArrayHasKey('is_blocked', $domain);

        $this->assertEquals('facebook.com', $domain['domain']);
        $this->assertEquals('Facebook', $domain['platform_name']);
        $this->assertTrue($domain['is_blocked']);
    }

    public function test_is_blocked_is_returned_as_boolean(): void
    {
        MonitoredDomain::create([
            'domain' => 'example.com',
            'platform_name' => 'Example',
            'is_blocked' => false,
        ]);

        $response = $this->withAgentAuth()
            ->getJson('/api/domains/sync');

        $response->assertOk();
        $this->assertIsBool($response->json('domains.0.is_blocked'));
    }

    public function test_returns_empty_array_when_no_domains_exist(): void
    {
        $response = $this->withAgentAuth()
            ->getJson('/api/domains/sync');

        $response->assertOk()
            ->assertJson(['domains' => []]);

        $this->assertCount(0, $response->json('domains'));
    }

    // ── Authentication ──────────────────────────────────────────────────

    public function test_requires_authentication(): void
    {
        config(['icon.security.verify_signatures' => false]);

        $this->getJson('/api/domains/sync')
            ->assertStatus(401);
    }

    public function test_rejects_invalid_api_key(): void
    {
        config(['icon.security.verify_signatures' => false]);

        $this->withHeaders(['X-Api-Key' => Str::random(64)])
            ->getJson('/api/domains/sync')
            ->assertStatus(401);
    }
}
