<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('Profile/Index', [
            'user' => [
                ...$user->only('id', 'name', 'email', 'role', 'notify_critical_alerts'),
                'two_factor_enabled' => $user->hasTwoFactorEnabled(),
            ],
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
}
