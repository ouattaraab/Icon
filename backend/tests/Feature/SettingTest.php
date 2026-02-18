<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SettingTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $manager;

    private User $viewer;

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
    }

    // ── Access control ──────────────────────────────────────────────────

    public function test_admin_can_access_settings(): void
    {
        $this->actingAs($this->admin)
            ->get('/settings')
            ->assertStatus(200);
    }

    public function test_manager_cannot_access_settings(): void
    {
        $this->actingAs($this->manager)
            ->get('/settings')
            ->assertStatus(403);
    }

    public function test_viewer_cannot_access_settings(): void
    {
        $this->actingAs($this->viewer)
            ->get('/settings')
            ->assertStatus(403);
    }

    public function test_unauthenticated_cannot_access_settings(): void
    {
        $this->get('/settings')
            ->assertRedirect('/login');
    }

    // ── Settings page loads with defaults ────────────────────────────────

    public function test_settings_page_shows_defaults(): void
    {
        $response = $this->actingAs($this->admin)->get('/settings');

        $response->assertStatus(200);
        $page = $response->original->getData()['page'];
        $settings = $page['props']['settings'];

        $this->assertEquals('90', $settings['event_retention_days']);
        $this->assertEquals('180', $settings['alert_retention_days']);
        $this->assertEquals('300', $settings['offline_threshold_seconds']);
        $this->assertEquals('1', $settings['dlp_enabled']);
    }

    public function test_settings_page_shows_saved_values(): void
    {
        Setting::setValue('event_retention_days', '30');
        Setting::setValue('dlp_enabled', '0');

        $response = $this->actingAs($this->admin)->get('/settings');
        $page = $response->original->getData()['page'];
        $settings = $page['props']['settings'];

        $this->assertEquals('30', $settings['event_retention_days']);
        $this->assertEquals('0', $settings['dlp_enabled']);
    }

    // ── Update settings ─────────────────────────────────────────────────

    public function test_admin_can_update_settings(): void
    {
        $this->actingAs($this->admin)
            ->put('/settings', [
                'event_retention_days' => 30,
                'alert_retention_days' => 60,
                'offline_threshold_seconds' => 120,
                'max_batch_size' => 50,
                'dlp_enabled' => true,
                'dlp_auto_alert' => false,
                'dlp_max_scan_length' => 10000,
                'agent_registration_key' => 'test-key-123',
                'agent_current_version' => '1.5.0',
                'agent_update_url' => 'https://cdn.gs2e.ci/agent.exe',
                'verify_signatures' => true,
            ])
            ->assertRedirect();

        $this->assertEquals('30', Setting::getValue('event_retention_days'));
        $this->assertEquals('60', Setting::getValue('alert_retention_days'));
        $this->assertEquals('120', Setting::getValue('offline_threshold_seconds'));
        $this->assertEquals('50', Setting::getValue('max_batch_size'));
        $this->assertEquals('1', Setting::getValue('dlp_enabled'));
        $this->assertEquals('0', Setting::getValue('dlp_auto_alert'));
        $this->assertEquals('10000', Setting::getValue('dlp_max_scan_length'));
        $this->assertEquals('test-key-123', Setting::getValue('agent_registration_key'));
        $this->assertEquals('1.5.0', Setting::getValue('agent_current_version'));
        $this->assertEquals('https://cdn.gs2e.ci/agent.exe', Setting::getValue('agent_update_url'));
        $this->assertEquals('1', Setting::getValue('verify_signatures'));
    }

    public function test_manager_cannot_update_settings(): void
    {
        $this->actingAs($this->manager)
            ->put('/settings', [
                'event_retention_days' => 30,
                'alert_retention_days' => 60,
                'offline_threshold_seconds' => 120,
                'max_batch_size' => 50,
                'dlp_enabled' => true,
                'dlp_auto_alert' => true,
                'dlp_max_scan_length' => 10000,
                'agent_current_version' => '1.0.0',
                'verify_signatures' => true,
            ])
            ->assertStatus(403);
    }

    // ── Validation ──────────────────────────────────────────────────────

    public function test_update_validates_retention_min(): void
    {
        $this->actingAs($this->admin)
            ->put('/settings', [
                'event_retention_days' => 1,
                'alert_retention_days' => 180,
                'offline_threshold_seconds' => 300,
                'max_batch_size' => 100,
                'dlp_enabled' => true,
                'dlp_auto_alert' => true,
                'dlp_max_scan_length' => 50000,
                'agent_current_version' => '0.1.0',
                'verify_signatures' => true,
            ])
            ->assertSessionHasErrors('event_retention_days');
    }

    public function test_update_validates_offline_threshold(): void
    {
        $this->actingAs($this->admin)
            ->put('/settings', [
                'event_retention_days' => 90,
                'alert_retention_days' => 180,
                'offline_threshold_seconds' => 10,
                'max_batch_size' => 100,
                'dlp_enabled' => true,
                'dlp_auto_alert' => true,
                'dlp_max_scan_length' => 50000,
                'agent_current_version' => '0.1.0',
                'verify_signatures' => true,
            ])
            ->assertSessionHasErrors('offline_threshold_seconds');
    }

    // ── Audit trail ─────────────────────────────────────────────────────

    public function test_update_creates_audit_log(): void
    {
        $this->actingAs($this->admin)
            ->put('/settings', [
                'event_retention_days' => 30,
                'alert_retention_days' => 180,
                'offline_threshold_seconds' => 300,
                'max_batch_size' => 100,
                'dlp_enabled' => true,
                'dlp_auto_alert' => true,
                'dlp_max_scan_length' => 50000,
                'agent_current_version' => '0.1.0',
                'agent_update_url' => '',
                'verify_signatures' => true,
            ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'settings.updated',
            'user_id' => $this->admin->id,
        ]);

        $log = AuditLog::where('action', 'settings.updated')->first();
        $this->assertArrayHasKey('event_retention_days', $log->details);
    }

    public function test_no_audit_log_when_no_changes(): void
    {
        // Set values first
        Setting::setValue('event_retention_days', '90');
        Setting::setValue('alert_retention_days', '180');
        Setting::setValue('offline_threshold_seconds', '300');
        Setting::setValue('max_batch_size', '100');
        Setting::setValue('dlp_enabled', '1');
        Setting::setValue('dlp_auto_alert', '1');
        Setting::setValue('dlp_max_scan_length', '50000');
        Setting::setValue('agent_current_version', '0.1.0');
        Setting::setValue('agent_update_url', '');
        Setting::setValue('verify_signatures', '1');

        $this->actingAs($this->admin)
            ->put('/settings', [
                'event_retention_days' => 90,
                'alert_retention_days' => 180,
                'offline_threshold_seconds' => 300,
                'max_batch_size' => 100,
                'dlp_enabled' => true,
                'dlp_auto_alert' => true,
                'dlp_max_scan_length' => 50000,
                'agent_current_version' => '0.1.0',
                'agent_update_url' => '',
                'verify_signatures' => true,
            ]);

        $this->assertDatabaseMissing('audit_logs', [
            'action' => 'settings.updated',
        ]);
    }

    // ── Setting model tests ─────────────────────────────────────────────

    public function test_setting_get_value_returns_default(): void
    {
        $this->assertEquals('fallback', Setting::getValue('nonexistent', 'fallback'));
    }

    public function test_setting_set_and_get_value(): void
    {
        Setting::setValue('test_key', 'test_value');
        $this->assertEquals('test_value', Setting::getValue('test_key'));
    }

    public function test_setting_get_many(): void
    {
        Setting::setValue('key1', 'val1');

        $result = Setting::getMany(['key1', 'key2'], ['key2' => 'default2']);

        $this->assertEquals('val1', $result['key1']);
        $this->assertEquals('default2', $result['key2']);
    }

    // ── Dashboard stats ─────────────────────────────────────────────────

    public function test_dashboard_includes_today_stats(): void
    {
        $response = $this->actingAs($this->admin)->get('/');
        $response->assertStatus(200);

        $page = $response->original->getData()['page'];
        $stats = $page['props']['stats'];

        $this->assertArrayHasKey('events_today', $stats);
        $this->assertArrayHasKey('blocked_today', $stats);
        $this->assertArrayHasKey('agent_version', $stats);
    }

    public function test_dashboard_includes_daily_events(): void
    {
        $response = $this->actingAs($this->admin)->get('/');

        $page = $response->original->getData()['page'];
        $this->assertArrayHasKey('dailyEvents', $page['props']);
    }
}
