<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class TwoFactorController extends Controller
{
    /**
     * Enable 2FA: generate secret + recovery codes, return QR data.
     */
    public function enable(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->hasTwoFactorEnabled()) {
            return response()->json(['error' => '2FA est déjà activé.'], 422);
        }

        $secret = $this->generateSecret();
        $recoveryCodes = $this->generateRecoveryCodes();

        $user->forceFill([
            'two_factor_secret' => $secret,
            'two_factor_recovery_codes' => $recoveryCodes,
            'two_factor_confirmed_at' => null,
        ])->save();

        $otpauthUrl = $this->buildOtpauthUrl($secret, $user->email);

        return response()->json([
            'secret' => $secret,
            'otpauth_url' => $otpauthUrl,
            'recovery_codes' => $recoveryCodes,
        ]);
    }

    /**
     * Confirm 2FA setup by verifying a TOTP code.
     */
    public function confirm(Request $request): RedirectResponse|JsonResponse
    {
        $request->validate([
            'code' => 'required|string|size:6',
        ]);

        $user = $request->user();

        if ($user->hasTwoFactorEnabled()) {
            return response()->json(['error' => '2FA est déjà confirmé.'], 422);
        }

        if (! $user->two_factor_secret) {
            return response()->json(['error' => 'Veuillez d\'abord activer le 2FA.'], 422);
        }

        if (! $this->verifyTotpCode($user->two_factor_secret, $request->input('code'))) {
            return response()->json(['error' => 'Code invalide. Réessayez.'], 422);
        }

        $user->forceFill(['two_factor_confirmed_at' => now()])->save();

        AuditLog::log('profile.2fa_enabled', 'User', $user->id);

        return response()->json(['success' => true, 'message' => 'Authentification à deux facteurs activée.']);
    }

    /**
     * Disable 2FA.
     */
    public function disable(Request $request): RedirectResponse
    {
        $request->validate([
            'password' => 'required|string',
        ]);

        $user = $request->user();

        if (! \Hash::check($request->input('password'), $user->getAuthPassword())) {
            return redirect()->back()->withErrors(['password' => 'Mot de passe incorrect.']);
        }

        $user->forceFill([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ])->save();

        AuditLog::log('profile.2fa_disabled', 'User', $user->id);

        return redirect()->back()->with('success', 'Authentification à deux facteurs désactivée.');
    }

    /**
     * Verify 2FA during login (called from login flow).
     */
    public function verify(Request $request): RedirectResponse
    {
        $request->validate([
            'code' => 'required|string',
            'user_id' => 'required|uuid',
        ]);

        $user = \App\Models\User::findOrFail($request->input('user_id'));

        $code = $request->input('code');
        $valid = false;

        // Try TOTP code first (6 digits)
        if (strlen($code) === 6 && $this->verifyTotpCode($user->two_factor_secret, $code)) {
            $valid = true;
        }

        // Try recovery code
        if (! $valid) {
            $recoveryCodes = $user->two_factor_recovery_codes ?? [];
            if (in_array($code, $recoveryCodes)) {
                $valid = true;
                // Remove used recovery code
                $user->forceFill([
                    'two_factor_recovery_codes' => array_values(array_filter($recoveryCodes, fn ($c) => $c !== $code)),
                ])->save();
                AuditLog::log('auth.2fa_recovery_used', 'User', $user->id);
            }
        }

        if (! $valid) {
            return redirect()->back()->withErrors(['code' => 'Code invalide.']);
        }

        // Complete login
        \Auth::login($user, $request->session()->get('2fa_remember', false));
        $request->session()->regenerate();
        $request->session()->forget(['2fa_user_id', '2fa_remember']);

        AuditLog::log('auth.login', 'User', (string) $user->id, [
            'email' => $user->email,
            '2fa' => true,
        ]);

        return redirect()->intended('/');
    }

    // ── Helpers ───────────────────────────────────────────────────────

    private function generateSecret(): string
    {
        // Generate a 20-byte random secret and base32-encode it
        $bytes = random_bytes(20);

        return $this->base32Encode($bytes);
    }

    private function generateRecoveryCodes(): array
    {
        $codes = [];
        for ($i = 0; $i < 8; $i++) {
            $codes[] = strtoupper(Str::random(4) . '-' . Str::random(4));
        }

        return $codes;
    }

    private function buildOtpauthUrl(string $secret, string $email): string
    {
        $issuer = 'Icon-GS2E';

        return 'otpauth://totp/' . rawurlencode($issuer) . ':' . rawurlencode($email)
            . '?secret=' . $secret
            . '&issuer=' . rawurlencode($issuer)
            . '&digits=6'
            . '&period=30';
    }

    private function verifyTotpCode(string $secret, string $code): bool
    {
        $key = $this->base32Decode($secret);
        $timeSlice = intdiv(time(), 30);

        // Check current and adjacent time slices (±1) for clock drift
        for ($offset = -1; $offset <= 1; $offset++) {
            $hash = hash_hmac('sha1', pack('N*', 0) . pack('N*', $timeSlice + $offset), $key, true);
            $offset_pos = ord($hash[19]) & 0x0F;
            $otp = (
                ((ord($hash[$offset_pos]) & 0x7F) << 24) |
                ((ord($hash[$offset_pos + 1]) & 0xFF) << 16) |
                ((ord($hash[$offset_pos + 2]) & 0xFF) << 8) |
                (ord($hash[$offset_pos + 3]) & 0xFF)
            ) % 1000000;

            if (str_pad((string) $otp, 6, '0', STR_PAD_LEFT) === $code) {
                return true;
            }
        }

        return false;
    }

    private function base32Encode(string $data): string
    {
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $binary = '';
        foreach (str_split($data) as $char) {
            $binary .= str_pad(decbin(ord($char)), 8, '0', STR_PAD_LEFT);
        }
        $result = '';
        foreach (str_split($binary, 5) as $chunk) {
            $chunk = str_pad($chunk, 5, '0', STR_PAD_RIGHT);
            $result .= $chars[bindec($chunk)];
        }

        return $result;
    }

    private function base32Decode(string $data): string
    {
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $binary = '';
        foreach (str_split(strtoupper($data)) as $char) {
            $pos = strpos($chars, $char);
            if ($pos === false) {
                continue;
            }
            $binary .= str_pad(decbin($pos), 5, '0', STR_PAD_LEFT);
        }
        $result = '';
        foreach (str_split($binary, 8) as $byte) {
            if (strlen($byte) < 8) {
                break;
            }
            $result .= chr(bindec($byte));
        }

        return $result;
    }
}
