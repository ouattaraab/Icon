<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function index(): Response
    {
        $users = User::orderBy('name')
            ->get()
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'notify_critical_alerts' => $user->notify_critical_alerts,
                'created_at' => $user->created_at,
            ]);

        return Inertia::render('Users/Index', [
            'users' => $users,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email',
            'password' => ['required', Password::min(8)],
            'role' => 'required|in:admin,manager,viewer',
        ]);

        $user = User::create($validated);

        AuditLog::log('user.created', 'User', $user->id, [
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
        ]);

        return back()->with('success', "Utilisateur « {$user->name} » créé.");
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => "required|email|max:255|unique:users,email,{$user->id}",
            'password' => ['nullable', Password::min(8)],
            'role' => 'required|in:admin,manager,viewer',
            'notify_critical_alerts' => 'boolean',
        ]);

        // Don't update password if not provided
        if (empty($validated['password'])) {
            unset($validated['password']);
        }

        $user->update($validated);

        AuditLog::log('user.updated', 'User', $user->id, [
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
        ]);

        return back()->with('success', "Utilisateur « {$user->name} » mis à jour.");
    }

    public function destroy(User $user): RedirectResponse
    {
        // Prevent self-deletion
        if ($user->id === auth()->id()) {
            return back()->with('error', 'Vous ne pouvez pas supprimer votre propre compte.');
        }

        $userName = $user->name;

        AuditLog::log('user.deleted', 'User', $user->id, [
            'name' => $userName,
            'email' => $user->email,
        ]);

        $user->delete();

        return back()->with('success', "Utilisateur « {$userName} » supprimé.");
    }
}
