<?php

namespace Tests\Feature;

use App\Models\Alert;
use App\Models\Machine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OfflineDetectionTest extends TestCase
{
    use RefreshDatabase;

    public function test_detects_offline_machines(): void
    {
        Machine::create([
            'hostname' => 'OFFLINE-PC',
            'os' => 'windows',
            'agent_version' => '0.1.0',
            'api_key_hash' => 'hash',
            'status' => 'active',
            'last_heartbeat' => now()->subMinutes(10),
        ]);

        Machine::create([
            'hostname' => 'ONLINE-PC',
            'os' => 'macos',
            'agent_version' => '0.1.0',
            'api_key_hash' => 'hash2',
            'status' => 'active',
            'last_heartbeat' => now(),
        ]);

        $this->artisan('icon:detect-offline')
            ->expectsOutputToContain('1 machine(s) marked as offline')
            ->assertSuccessful();

        $offlineMachine = Machine::where('hostname', 'OFFLINE-PC')->first();
        $this->assertEquals('offline', $offlineMachine->status);

        $onlineMachine = Machine::where('hostname', 'ONLINE-PC')->first();
        $this->assertEquals('active', $onlineMachine->status);
    }

    public function test_creates_alert_for_offline_machine(): void
    {
        Machine::create([
            'hostname' => 'OFFLINE-PC',
            'os' => 'windows',
            'agent_version' => '0.1.0',
            'api_key_hash' => 'hash',
            'status' => 'active',
            'last_heartbeat' => now()->subMinutes(10),
        ]);

        $this->artisan('icon:detect-offline')->assertSuccessful();

        $this->assertDatabaseHas('alerts', [
            'severity' => 'warning',
            'status' => 'open',
        ]);

        $alert = Alert::first();
        $this->assertStringContains('OFFLINE-PC', $alert->title);
    }

    public function test_creates_audit_log_for_offline_machine(): void
    {
        Machine::create([
            'hostname' => 'OFFLINE-PC',
            'os' => 'windows',
            'agent_version' => '0.1.0',
            'api_key_hash' => 'hash',
            'status' => 'active',
            'last_heartbeat' => now()->subMinutes(10),
        ]);

        $this->artisan('icon:detect-offline')->assertSuccessful();

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'machine.offline',
            'target_type' => 'Machine',
        ]);
    }

    public function test_does_not_affect_already_offline_machines(): void
    {
        Machine::create([
            'hostname' => 'ALREADY-OFFLINE',
            'os' => 'windows',
            'agent_version' => '0.1.0',
            'api_key_hash' => 'hash',
            'status' => 'offline',
            'last_heartbeat' => now()->subMinutes(10),
        ]);

        $this->artisan('icon:detect-offline')
            ->expectsOutputToContain('All machines are online')
            ->assertSuccessful();

        $this->assertDatabaseCount('alerts', 0);
    }

    public function test_all_machines_online(): void
    {
        Machine::create([
            'hostname' => 'ONLINE-PC',
            'os' => 'windows',
            'agent_version' => '0.1.0',
            'api_key_hash' => 'hash',
            'status' => 'active',
            'last_heartbeat' => now(),
        ]);

        $this->artisan('icon:detect-offline')
            ->expectsOutputToContain('All machines are online')
            ->assertSuccessful();
    }

    private function assertStringContains(string $needle, string $haystack): void
    {
        $this->assertTrue(
            str_contains($haystack, $needle),
            "Failed asserting that '{$haystack}' contains '{$needle}'"
        );
    }
}
