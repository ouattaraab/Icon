<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ProfileTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'name' => 'Test User',
            'email' => 'test@gs2e.ci',
            'password' => bcrypt('password'),
            'role' => 'viewer',
        ]);
    }

    // ── Profile page ────────────────────────────────────────────────────

    public function test_profile_page_loads(): void
    {
        $this->actingAs($this->user)
            ->get('/profile')
            ->assertStatus(200);
    }

    public function test_profile_page_requires_auth(): void
    {
        $this->get('/profile')
            ->assertRedirect('/login');
    }

    public function test_profile_page_shows_user_data(): void
    {
        $response = $this->actingAs($this->user)->get('/profile');
        $page = $response->original->getData()['page'];
        $userData = $page['props']['user'];

        $this->assertEquals('Test User', $userData['name']);
        $this->assertEquals('test@gs2e.ci', $userData['email']);
        $this->assertEquals('viewer', $userData['role']);
    }

    // ── Update profile ──────────────────────────────────────────────────

    public function test_update_profile_name(): void
    {
        $this->actingAs($this->user)
            ->put('/profile', [
                'name' => 'Updated Name',
                'email' => 'test@gs2e.ci',
            ])
            ->assertRedirect();

        $this->user->refresh();
        $this->assertEquals('Updated Name', $this->user->name);
    }

    public function test_update_profile_email(): void
    {
        $this->actingAs($this->user)
            ->put('/profile', [
                'name' => 'Test User',
                'email' => 'new@gs2e.ci',
            ])
            ->assertRedirect();

        $this->user->refresh();
        $this->assertEquals('new@gs2e.ci', $this->user->email);
    }

    public function test_update_profile_creates_audit_log(): void
    {
        $this->actingAs($this->user)
            ->put('/profile', [
                'name' => 'Changed Name',
                'email' => 'test@gs2e.ci',
            ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'profile.updated',
            'user_id' => $this->user->id,
        ]);
    }

    public function test_update_profile_validates_email_unique(): void
    {
        User::create([
            'name' => 'Other',
            'email' => 'other@gs2e.ci',
            'password' => bcrypt('password'),
            'role' => 'viewer',
        ]);

        $this->actingAs($this->user)
            ->put('/profile', [
                'name' => 'Test User',
                'email' => 'other@gs2e.ci',
            ])
            ->assertSessionHasErrors('email');
    }

    public function test_update_profile_allows_same_email(): void
    {
        $this->actingAs($this->user)
            ->put('/profile', [
                'name' => 'Test User',
                'email' => 'test@gs2e.ci',
            ])
            ->assertRedirect()
            ->assertSessionHasNoErrors();
    }

    // ── Change password ─────────────────────────────────────────────────

    public function test_change_password(): void
    {
        $this->actingAs($this->user)
            ->put('/profile/password', [
                'current_password' => 'password',
                'password' => 'newpassword123',
                'password_confirmation' => 'newpassword123',
            ])
            ->assertRedirect();

        $this->user->refresh();
        $this->assertTrue(Hash::check('newpassword123', $this->user->password));
    }

    public function test_change_password_wrong_current(): void
    {
        $this->actingAs($this->user)
            ->put('/profile/password', [
                'current_password' => 'wrongpassword',
                'password' => 'newpassword123',
                'password_confirmation' => 'newpassword123',
            ])
            ->assertSessionHasErrors('current_password');
    }

    public function test_change_password_confirmation_mismatch(): void
    {
        $this->actingAs($this->user)
            ->put('/profile/password', [
                'current_password' => 'password',
                'password' => 'newpassword123',
                'password_confirmation' => 'different',
            ])
            ->assertSessionHasErrors('password');
    }

    public function test_change_password_too_short(): void
    {
        $this->actingAs($this->user)
            ->put('/profile/password', [
                'current_password' => 'password',
                'password' => 'short',
                'password_confirmation' => 'short',
            ])
            ->assertSessionHasErrors('password');
    }

    public function test_change_password_creates_audit_log(): void
    {
        $this->actingAs($this->user)
            ->put('/profile/password', [
                'current_password' => 'password',
                'password' => 'newpassword123',
                'password_confirmation' => 'newpassword123',
            ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'profile.password_changed',
            'user_id' => $this->user->id,
        ]);
    }

    // ── Notification preferences ────────────────────────────────────────

    public function test_enable_critical_alerts(): void
    {
        $this->actingAs($this->user)
            ->put('/profile/notifications', [
                'notify_critical_alerts' => true,
            ])
            ->assertRedirect();

        $this->user->refresh();
        $this->assertTrue($this->user->notify_critical_alerts);
    }

    public function test_disable_critical_alerts(): void
    {
        $this->user->update(['notify_critical_alerts' => true]);

        $this->actingAs($this->user)
            ->put('/profile/notifications', [
                'notify_critical_alerts' => false,
            ])
            ->assertRedirect();

        $this->user->refresh();
        $this->assertFalse($this->user->notify_critical_alerts);
    }

    public function test_notification_update_creates_audit_log(): void
    {
        $this->actingAs($this->user)
            ->put('/profile/notifications', [
                'notify_critical_alerts' => true,
            ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'profile.notifications_updated',
            'user_id' => $this->user->id,
        ]);
    }
}
