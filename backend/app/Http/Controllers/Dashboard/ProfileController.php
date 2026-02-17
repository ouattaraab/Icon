<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $currentSessionId = $request->session()->getId();

        $sessions = DB::table('sessions')
            ->where('user_id', $user->id)
            ->orderByDesc('last_activity')
            ->get()
            ->map(fn ($session) => [
                'id' => $session->id,
                'ip_address' => $session->ip_address,
                'user_agent' => $this->parseUserAgent($session->user_agent),
                'last_activity' => Carbon::createFromTimestamp($session->last_activity)->diffForHumans(),
                'last_activity_ts' => $session->last_activity,
                'is_current' => $session->id === $currentSessionId,
            ]);

        return Inertia::render('Profile/Index', [
            'user' => [
                ...$user->only('id', 'name', 'email', 'role', 'notify_critical_alerts'),
                'two_factor_enabled' => $user->hasTwoFactorEnabled(),
            ],
            'sessions' => $sessions,
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => "required|email|unique:users,email,{$user->id}",
        ]);

        $changes = [];
        if ($user->name !== $validated['name']) {
            $changes['name'] = ['old' => $user->name, 'new' => $validated['name']];
        }
        if ($user->email !== $validated['email']) {
            $changes['email'] = ['old' => $user->email, 'new' => $validated['email']];
        }

        $user->update($validated);

        if (!empty($changes)) {
            AuditLog::log('profile.updated', 'User', $user->id, $changes);
        }

        return redirect()->back()->with('success', 'Profil mis à jour.');
    }

    public function updatePassword(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'current_password' => 'required',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user = $request->user();

        if (!Hash::check($validated['current_password'], $user->password)) {
            return redirect()->back()->withErrors(['current_password' => 'Mot de passe actuel incorrect.']);
        }

        $user->update(['password' => $validated['password']]);

        AuditLog::log('profile.password_changed', 'User', $user->id);

        return redirect()->back()->with('success', 'Mot de passe modifié.');
    }

    public function updateNotifications(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'notify_critical_alerts' => 'required|boolean',
        ]);

        $user = $request->user();
        $oldValue = $user->notify_critical_alerts;
        $user->update($validated);

        if ($oldValue !== $validated['notify_critical_alerts']) {
            AuditLog::log('profile.notifications_updated', 'User', $user->id, [
                'notify_critical_alerts' => [
                    'old' => $oldValue,
                    'new' => $validated['notify_critical_alerts'],
                ],
            ]);
        }

        return redirect()->back()->with('success', 'Préférences de notification mises à jour.');
    }

    public function revokeSession(Request $request, string $sessionId): RedirectResponse
    {
        $user = $request->user();
        $currentSessionId = $request->session()->getId();

        if ($sessionId === $currentSessionId) {
            return redirect()->back()->withErrors(['session' => 'Vous ne pouvez pas révoquer la session actuelle.']);
        }

        $deleted = DB::table('sessions')
            ->where('id', $sessionId)
            ->where('user_id', $user->id)
            ->delete();

        if ($deleted) {
            AuditLog::log('profile.session_revoked', 'User', $user->id, [
                'session_id' => substr($sessionId, 0, 8) . '...',
            ]);
        }

        return redirect()->back()->with('success', 'Session révoquée.');
    }

    public function revokeAllSessions(Request $request): RedirectResponse
    {
        $request->validate([
            'password' => 'required|string',
        ]);

        $user = $request->user();

        if (!Hash::check($request->input('password'), $user->password)) {
            return redirect()->back()->withErrors(['password' => 'Mot de passe incorrect.']);
        }

        $currentSessionId = $request->session()->getId();

        $count = DB::table('sessions')
            ->where('user_id', $user->id)
            ->where('id', '!=', $currentSessionId)
            ->delete();

        if ($count > 0) {
            AuditLog::log('profile.all_sessions_revoked', 'User', $user->id, [
                'count' => $count,
            ]);
        }

        return redirect()->back()->with('success', "{$count} session(s) révoquée(s).");
    }

    private function parseUserAgent(?string $userAgent): string
    {
        if (!$userAgent) {
            return 'Inconnu';
        }

        $browser = 'Navigateur inconnu';
        $os = '';

        if (str_contains($userAgent, 'Firefox')) {
            $browser = 'Firefox';
        } elseif (str_contains($userAgent, 'Edg')) {
            $browser = 'Edge';
        } elseif (str_contains($userAgent, 'Chrome')) {
            $browser = 'Chrome';
        } elseif (str_contains($userAgent, 'Safari')) {
            $browser = 'Safari';
        }

        if (str_contains($userAgent, 'Windows')) {
            $os = 'Windows';
        } elseif (str_contains($userAgent, 'Macintosh')) {
            $os = 'macOS';
        } elseif (str_contains($userAgent, 'Linux')) {
            $os = 'Linux';
        } elseif (str_contains($userAgent, 'iPhone') || str_contains($userAgent, 'iPad')) {
            $os = 'iOS';
        } elseif (str_contains($userAgent, 'Android')) {
            $os = 'Android';
        }

        return $os ? "{$browser} sur {$os}" : $browser;
    }
}
