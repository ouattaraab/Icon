<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Middleware to restrict access based on user role.
 *
 * Roles hierarchy: admin > manager > viewer
 * - admin: full access (users, rules, domains, alerts, reports, audit)
 * - manager: can manage rules, domains, alerts, but NOT users
 * - viewer: read-only access to all pages
 *
 * Usage in routes:
 *   ->middleware('role:admin')      // admin only
 *   ->middleware('role:manager')    // admin or manager
 */
class RequireRole
{
    public function handle(Request $request, Closure $next, string $role): Response
    {
        $user = $request->user();

        if (! $user) {
            return redirect()->route('login');
        }

        $allowed = match ($role) {
            'admin' => $user->isAdmin(),
            'manager' => $user->isManager(),
            default => true,
        };

        if (! $allowed) {
            abort(403, 'Accès interdit. Rôle requis : ' . $role);
        }

        return $next($request);
    }
}
