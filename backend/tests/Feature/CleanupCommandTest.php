<?php

namespace Tests\Feature;

use App\Models\Alert;
use App\Models\AuditLog;
use App\Models\Machine;
use App\Models\User;
use App\Notifications\CriticalAlertNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CleanupCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_cleanup_deletes_old_read_notifications(): void
    {
        $user = User::create([
            'name' => 'Admin', 'email' => 'admin@gs2e.ci',
            'password' => 'password', 'role' => 'admin',
        ]);
        $machine = Machine::create([
            'hostname' => 'PC', 'os' => 'windows',
            'agent_version' => '0.1.0', 'api_key_hash' => 'h', 'status' => 'active',
        ]);
        $alert = Alert::create([
            'machine_id' => $machine->id, 'severity' => 'critical',
            'title' => 'Test', 'status' => 'open',
        ]);

        $user->notify(new CriticalAlertNotification($alert));
        $notif = $user->notifications()->first();
        $notif->markAsRead();

        // Backdate the read_at to 60 days ago
        $notif->update(['read_at' => now()->subDays(60)]);

        $this->artisan('icon:cleanup', ['--notifications-days' => 30])
            ->assertSuccessful();

        $this->assertEquals(0, $user->notifications()->count());
    }

    public function test_cleanup_keeps_recent_read_notifications(): void
    {
        $user = User::create([
            'name' => 'Admin', 'email' => 'admin@gs2e.ci',
            'password' => 'password', 'role' => 'admin',
        ]);
        $machine = Machine::create([
            'hostname' => 'PC', 'os' => 'windows',
            'agent_version' => '0.1.0', 'api_key_hash' => 'h', 'status' => 'active',
        ]);
        $alert = Alert::create([
            'machine_id' => $machine->id, 'severity' => 'critical',
            'title' => 'Test', 'status' => 'open',
        ]);

        $user->notify(new CriticalAlertNotification($alert));
        $user->notifications()->first()->markAsRead();

        $this->artisan('icon:cleanup', ['--notifications-days' => 30])
            ->assertSuccessful();

        // Should still exist (read less than 30 days ago)
        $this->assertEquals(1, $user->notifications()->count());
    }

    public function test_cleanup_deletes_old_audit_logs(): void
    {
        $old = AuditLog::create(['action' => 'test.old']);
        $old->forceFill(['created_at' => now()->subDays(400)])->save();

        $recent = AuditLog::create(['action' => 'test.recent']);
        $recent->forceFill(['created_at' => now()->subDays(30)])->save();

        $this->artisan('icon:cleanup', ['--audit-days' => 365])
            ->assertSuccessful();

        $this->assertDatabaseMissing('audit_logs', ['action' => 'test.old']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'test.recent']);
    }

    public function test_cleanup_creates_audit_log(): void
    {
        $this->artisan('icon:cleanup')->assertSuccessful();

        $this->assertDatabaseHas('audit_logs', ['action' => 'system.cleanup']);
    }
}
