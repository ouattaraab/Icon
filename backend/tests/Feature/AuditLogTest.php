<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AuditLogTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::create([
            'name' => 'Admin',
            'email' => 'admin@gs2e.ci',
            'password' => bcrypt('password'),
            'role' => 'admin',
        ]);
    }

    public function test_audit_page_requires_auth(): void
    {
        $response = $this->get('/audit');
        $response->assertRedirect('/login');
    }

    public function test_audit_page_loads(): void
    {
        $response = $this->actingAs($this->admin)->get('/audit');
        $response->assertStatus(200);
    }

    public function test_audit_page_shows_logs(): void
    {
        AuditLog::log('test.action', 'TestModel', null, ['key' => 'value']);

        $response = $this->actingAs($this->admin)->get('/audit');
        $response->assertStatus(200);
    }

    public function test_audit_log_filter_by_action(): void
    {
        $uuid1 = (string) Str::uuid();
        $uuid2 = (string) Str::uuid();
        AuditLog::log('domain.created', 'MonitoredDomain', $uuid1);
        AuditLog::log('auth.login', 'User', $uuid2);

        $response = $this->actingAs($this->admin)->get('/audit?action=domain');
        $response->assertStatus(200);
    }

    public function test_audit_log_filter_by_date(): void
    {
        AuditLog::log('domain.created', 'MonitoredDomain', (string) Str::uuid());

        $response = $this->actingAs($this->admin)->get('/audit?date_from=' . now()->format('Y-m-d'));
        $response->assertStatus(200);
    }

    public function test_login_creates_audit_log(): void
    {
        User::create([
            'name' => 'Test',
            'email' => 'test@gs2e.ci',
            'password' => bcrypt('password'),
            'role' => 'viewer',
        ]);

        $this->post('/login', [
            'email' => 'test@gs2e.ci',
            'password' => 'password',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'auth.login',
            'target_type' => 'User',
        ]);
    }

    public function test_logout_creates_audit_log(): void
    {
        $this->actingAs($this->admin)->post('/logout');

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'auth.logout',
            'target_type' => 'User',
        ]);
    }

    public function test_audit_log_model_stores_details(): void
    {
        AuditLog::log('test.action', 'TestModel', null, [
            'key1' => 'value1',
            'key2' => 42,
        ]);

        $log = AuditLog::where('action', 'test.action')->first();

        $this->assertNotNull($log);
        $this->assertEquals('value1', $log->details['key1']);
        $this->assertEquals(42, $log->details['key2']);
    }

    public function test_audit_log_belongs_to_user(): void
    {
        $this->actingAs($this->admin);

        AuditLog::log('test.action', 'TestModel', null);

        $log = AuditLog::where('action', 'test.action')->first();
        $this->assertEquals($this->admin->id, $log->user_id);
    }
}
