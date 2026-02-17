<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TwoFactorTest extends TestCase
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
            'role' => 'admin',
        ]);
    }

    public function test_enable_2fa_returns_secret(): void
    {
        $response = $this->actingAs($this->user)
            ->postJson('/two-factor/enable');

        $response->assertOk()
            ->assertJsonStructure(['secret', 'otpauth_url', 'recovery_codes']);

        $data = $response->json();
        $this->assertCount(8, $data['recovery_codes']);
        $this->assertStringContains('otpauth://totp/', $data['otpauth_url']);
    }

    public function test_enable_2fa_stores_secret(): void
    {
        $this->actingAs($this->user)->postJson('/two-factor/enable');

        $this->user->refresh();
        $this->assertNotNull($this->user->two_factor_secret);
        $this->assertNotNull($this->user->two_factor_recovery_codes);
        $this->assertNull($this->user->two_factor_confirmed_at);
    }

    public function test_cannot_enable_2fa_twice(): void
    {
        $this->user->forceFill([
            'two_factor_secret' => 'secret',
            'two_factor_confirmed_at' => now(),
        ])->save();

        $this->actingAs($this->user)
            ->postJson('/two-factor/enable')
            ->assertStatus(422);
    }

    public function test_confirm_2fa_with_invalid_code(): void
    {
        // First enable
        $this->actingAs($this->user)->postJson('/two-factor/enable');

        $response = $this->actingAs($this->user)
            ->postJson('/two-factor/confirm', ['code' => '000000']);

        $response->assertStatus(422)
            ->assertJsonFragment(['error' => 'Code invalide. Réessayez.']);
    }

    public function test_confirm_requires_enable_first(): void
    {
        $this->actingAs($this->user)
            ->postJson('/two-factor/confirm', ['code' => '123456'])
            ->assertStatus(422);
    }

    public function test_disable_2fa_requires_password(): void
    {
        $this->user->forceFill([
            'two_factor_secret' => 'secret',
            'two_factor_confirmed_at' => now(),
        ])->save();

        $this->actingAs($this->user)
            ->delete('/two-factor/disable', ['password' => 'wrong'])
            ->assertSessionHasErrors('password');
    }

    public function test_disable_2fa_with_correct_password(): void
    {
        $this->user->forceFill([
            'two_factor_secret' => 'secret',
            'two_factor_recovery_codes' => ['CODE-1', 'CODE-2'],
            'two_factor_confirmed_at' => now(),
        ])->save();

        $this->actingAs($this->user)
            ->delete('/two-factor/disable', ['password' => 'password'])
            ->assertRedirect();

        $this->user->refresh();
        $this->assertNull($this->user->two_factor_secret);
        $this->assertNull($this->user->two_factor_recovery_codes);
        $this->assertNull($this->user->two_factor_confirmed_at);
    }

    public function test_disable_2fa_creates_audit_log(): void
    {
        $this->user->forceFill([
            'two_factor_secret' => 'secret',
            'two_factor_confirmed_at' => now(),
        ])->save();

        $this->actingAs($this->user)
            ->delete('/two-factor/disable', ['password' => 'password']);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'profile.2fa_disabled',
            'target_id' => $this->user->id,
        ]);
    }

    public function test_login_with_2fa_redirects_to_challenge(): void
    {
        $this->user->forceFill([
            'two_factor_secret' => 'secret',
            'two_factor_confirmed_at' => now(),
        ])->save();

        $response = $this->post('/login', [
            'email' => 'test@gs2e.ci',
            'password' => 'password',
        ]);

        $response->assertRedirect(route('two-factor.challenge'));
        $this->assertGuest(); // Not yet authenticated
    }

    public function test_login_without_2fa_authenticates_directly(): void
    {
        $response = $this->post('/login', [
            'email' => 'test@gs2e.ci',
            'password' => 'password',
        ]);

        $response->assertRedirect('/');
        $this->assertAuthenticatedAs($this->user);
    }

    public function test_2fa_challenge_page_loads(): void
    {
        $this->withSession(['2fa_user_id' => $this->user->id])
            ->get('/two-factor-challenge')
            ->assertOk();
    }

    public function test_2fa_verify_with_invalid_code(): void
    {
        $this->user->forceFill([
            'two_factor_secret' => 'JBSWY3DPEHPK3PXP',
            'two_factor_confirmed_at' => now(),
        ])->save();

        $response = $this->withSession(['2fa_user_id' => $this->user->id])
            ->post('/two-factor-challenge', [
                'code' => '000000',
                'user_id' => $this->user->id,
            ]);

        $response->assertSessionHasErrors('code');
    }

    public function test_2fa_verify_with_recovery_code(): void
    {
        $this->user->forceFill([
            'two_factor_secret' => 'JBSWY3DPEHPK3PXP',
            'two_factor_recovery_codes' => ['AAAA-BBBB', 'CCCC-DDDD'],
            'two_factor_confirmed_at' => now(),
        ])->save();

        $this->withSession([
            '2fa_user_id' => $this->user->id,
            '2fa_remember' => false,
        ])->post('/two-factor-challenge', [
            'code' => 'AAAA-BBBB',
            'user_id' => $this->user->id,
        ])->assertRedirect('/');

        $this->assertAuthenticatedAs($this->user);

        // Recovery code removed
        $this->user->refresh();
        $this->assertNotContains('AAAA-BBBB', $this->user->two_factor_recovery_codes);
        $this->assertContains('CCCC-DDDD', $this->user->two_factor_recovery_codes);
    }

    public function test_2fa_recovery_creates_audit_log(): void
    {
        $this->user->forceFill([
            'two_factor_secret' => 'JBSWY3DPEHPK3PXP',
            'two_factor_recovery_codes' => ['AAAA-BBBB'],
            'two_factor_confirmed_at' => now(),
        ])->save();

        $this->withSession([
            '2fa_user_id' => $this->user->id,
            '2fa_remember' => false,
        ])->post('/two-factor-challenge', [
            'code' => 'AAAA-BBBB',
            'user_id' => $this->user->id,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'auth.2fa_recovery_used',
            'target_id' => $this->user->id,
        ]);
    }

    public function test_has_two_factor_enabled(): void
    {
        $this->assertFalse($this->user->hasTwoFactorEnabled());

        $this->user->forceFill(['two_factor_confirmed_at' => now()])->save();
        $this->user->refresh();
        $this->assertTrue($this->user->hasTwoFactorEnabled());
    }

    public function test_enable_2fa_requires_auth(): void
    {
        $this->postJson('/two-factor/enable')
            ->assertStatus(401);
    }

    // Helper for assertStringContains (PHPUnit 10+ compat)
    private function assertStringContains(string $needle, string $haystack): void
    {
        $this->assertStringContainsString($needle, $haystack);
    }
}
