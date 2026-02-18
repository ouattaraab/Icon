<?php

namespace Tests\Feature;

use App\Models\MonitoredDomain;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DomainCrudTest extends TestCase
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

    public function test_domains_page_requires_auth(): void
    {
        $response = $this->get('/domains');
        $response->assertRedirect('/login');
    }

    public function test_domains_page_loads(): void
    {
        $response = $this->actingAs($this->admin)->get('/domains');
        $response->assertStatus(200);
    }

    public function test_domains_page_shows_domains(): void
    {
        MonitoredDomain::create([
            'domain' => 'api.openai.com',
            'platform_name' => 'ChatGPT',
            'is_blocked' => false,
        ]);

        $response = $this->actingAs($this->admin)->get('/domains');

        $response->assertStatus(200);
    }

    public function test_store_domain(): void
    {
        $response = $this->actingAs($this->admin)->post('/domains', [
            'domain' => 'api.openai.com',
            'platform_name' => 'ChatGPT',
            'is_blocked' => false,
        ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('monitored_domains', [
            'domain' => 'api.openai.com',
            'platform_name' => 'ChatGPT',
            'is_blocked' => false,
        ]);
    }

    public function test_store_domain_creates_audit_log(): void
    {
        $this->actingAs($this->admin)->post('/domains', [
            'domain' => 'claude.ai',
            'platform_name' => 'Claude',
            'is_blocked' => false,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'domain.created',
            'target_type' => 'MonitoredDomain',
        ]);
    }

    public function test_store_domain_validation_requires_fields(): void
    {
        $response = $this->actingAs($this->admin)->post('/domains', []);

        $response->assertSessionHasErrors(['domain', 'platform_name']);
    }

    public function test_store_domain_unique_constraint(): void
    {
        MonitoredDomain::create([
            'domain' => 'api.openai.com',
            'platform_name' => 'ChatGPT',
        ]);

        $response = $this->actingAs($this->admin)->post('/domains', [
            'domain' => 'api.openai.com',
            'platform_name' => 'OpenAI',
        ]);

        $response->assertSessionHasErrors(['domain']);
    }

    public function test_update_domain(): void
    {
        $domain = MonitoredDomain::create([
            'domain' => 'api.openai.com',
            'platform_name' => 'ChatGPT',
            'is_blocked' => false,
        ]);

        $response = $this->actingAs($this->admin)->put("/domains/{$domain->id}", [
            'domain' => 'chat.openai.com',
            'platform_name' => 'ChatGPT Plus',
            'is_blocked' => true,
        ]);

        $response->assertRedirect();

        $domain->refresh();
        $this->assertEquals('chat.openai.com', $domain->domain);
        $this->assertEquals('ChatGPT Plus', $domain->platform_name);
        $this->assertTrue($domain->is_blocked);
    }

    public function test_update_domain_creates_audit_log(): void
    {
        $domain = MonitoredDomain::create([
            'domain' => 'api.openai.com',
            'platform_name' => 'ChatGPT',
        ]);

        $this->actingAs($this->admin)->put("/domains/{$domain->id}", [
            'domain' => 'api.openai.com',
            'platform_name' => 'OpenAI API',
            'is_blocked' => false,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'domain.updated',
            'target_type' => 'MonitoredDomain',
            'target_id' => $domain->id,
        ]);
    }

    public function test_update_domain_allows_same_name_for_same_record(): void
    {
        $domain = MonitoredDomain::create([
            'domain' => 'api.openai.com',
            'platform_name' => 'ChatGPT',
        ]);

        $response = $this->actingAs($this->admin)->put("/domains/{$domain->id}", [
            'domain' => 'api.openai.com',
            'platform_name' => 'OpenAI',
            'is_blocked' => false,
        ]);

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();
    }

    public function test_delete_domain(): void
    {
        $domain = MonitoredDomain::create([
            'domain' => 'api.openai.com',
            'platform_name' => 'ChatGPT',
        ]);

        $response = $this->actingAs($this->admin)->delete("/domains/{$domain->id}");

        $response->assertRedirect();
        $this->assertDatabaseMissing('monitored_domains', ['id' => $domain->id]);
    }

    public function test_delete_domain_creates_audit_log(): void
    {
        $domain = MonitoredDomain::create([
            'domain' => 'api.openai.com',
            'platform_name' => 'ChatGPT',
        ]);

        $this->actingAs($this->admin)->delete("/domains/{$domain->id}");

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'domain.deleted',
            'target_type' => 'MonitoredDomain',
        ]);
    }

    public function test_toggle_blocked(): void
    {
        $domain = MonitoredDomain::create([
            'domain' => 'api.openai.com',
            'platform_name' => 'ChatGPT',
            'is_blocked' => false,
        ]);

        $response = $this->actingAs($this->admin)->post("/domains/{$domain->id}/toggle");

        $response->assertRedirect();

        $domain->refresh();
        $this->assertTrue($domain->is_blocked);
    }

    public function test_toggle_blocked_twice_restores_state(): void
    {
        $domain = MonitoredDomain::create([
            'domain' => 'api.openai.com',
            'platform_name' => 'ChatGPT',
            'is_blocked' => false,
        ]);

        $this->actingAs($this->admin)->post("/domains/{$domain->id}/toggle");
        $this->actingAs($this->admin)->post("/domains/{$domain->id}/toggle");

        $domain->refresh();
        $this->assertFalse($domain->is_blocked);
    }

    public function test_toggle_blocked_creates_audit_log(): void
    {
        $domain = MonitoredDomain::create([
            'domain' => 'api.openai.com',
            'platform_name' => 'ChatGPT',
            'is_blocked' => false,
        ]);

        $this->actingAs($this->admin)->post("/domains/{$domain->id}/toggle");

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'domain.blocked',
            'target_type' => 'MonitoredDomain',
            'target_id' => $domain->id,
        ]);
    }

    public function test_toggle_unblocked_creates_audit_log(): void
    {
        $domain = MonitoredDomain::create([
            'domain' => 'api.openai.com',
            'platform_name' => 'ChatGPT',
            'is_blocked' => true,
        ]);

        $this->actingAs($this->admin)->post("/domains/{$domain->id}/toggle");

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'domain.unblocked',
            'target_type' => 'MonitoredDomain',
            'target_id' => $domain->id,
        ]);
    }
}
