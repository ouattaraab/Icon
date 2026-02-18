<?php

use App\Http\Controllers\Api\ApiDocController;
use App\Http\Controllers\Dashboard\AlertController;
use App\Http\Controllers\Dashboard\AuditLogController;
use App\Http\Controllers\Dashboard\DashboardController;
use App\Http\Controllers\Dashboard\DepartmentController;
use App\Http\Controllers\Dashboard\DeploymentController;
use App\Http\Controllers\Dashboard\DomainController;
use App\Http\Controllers\Dashboard\ExchangeController;
use App\Http\Controllers\Dashboard\MachineController;
use App\Http\Controllers\Dashboard\NotificationController;
use App\Http\Controllers\Dashboard\ProfileController;
use App\Http\Controllers\Dashboard\ReportController;
use App\Http\Controllers\Dashboard\RuleController;
use App\Http\Controllers\Dashboard\SearchController;
use App\Http\Controllers\Dashboard\SettingController;
use App\Http\Controllers\Dashboard\TagController;
use App\Http\Controllers\Dashboard\TwoFactorController;
use App\Http\Controllers\Dashboard\UserController;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| API Documentation
|--------------------------------------------------------------------------
*/

Route::get('/api/docs', [ApiDocController::class, 'index'])->name('api.docs');
Route::get('/api/docs/spec', [ApiDocController::class, 'spec'])->name('api.docs.spec');

/*
|--------------------------------------------------------------------------
| Authentication Routes
|--------------------------------------------------------------------------
*/

Route::get('/login', fn () => Inertia::render('Auth/Login'))->name('login');

Route::post('/login', function (Request $request) {
    $credentials = $request->validate([
        'email' => 'required|email',
        'password' => 'required',
    ]);

    if (Auth::attempt($credentials, $request->boolean('remember'))) {
        $user = Auth::user();

        // If 2FA is enabled, redirect to challenge page
        if ($user->hasTwoFactorEnabled()) {
            Auth::logout();
            $request->session()->put('2fa_user_id', $user->id);
            $request->session()->put('2fa_remember', $request->boolean('remember'));

            return redirect()->route('two-factor.challenge');
        }

        $request->session()->regenerate();
        AuditLog::log('auth.login', 'User', (string) $user->id, [
            'email' => $user->email,
        ]);

        return redirect()->intended('/');
    }

    return back()->withErrors(['email' => 'Identifiants invalides.']);
})->name('login.store');

Route::post('/logout', function (Request $request) {
    AuditLog::log('auth.logout', 'User', (string) Auth::id());
    Auth::logout();
    $request->session()->invalidate();
    $request->session()->regenerateToken();

    return redirect('/login');
})->name('logout');

// 2FA verification (during login, before full auth)
Route::get('/two-factor-challenge', fn () => Inertia::render('Auth/TwoFactorChallenge', [
    'user_id' => session('2fa_user_id'),
]))->name('two-factor.challenge');
Route::post('/two-factor-challenge', [TwoFactorController::class, 'verify'])->name('two-factor.verify');

/*
|--------------------------------------------------------------------------
| Dashboard Routes (Inertia/React)
|--------------------------------------------------------------------------
*/

Route::middleware(['auth'])->group(function () {

    // ── Read-only pages (all roles) ──────────────────────────────────

    // Dashboard home
    Route::get('/', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('/dashboard/live', [DashboardController::class, 'liveStats'])->name('dashboard.live');
    Route::put('/dashboard/config', [DashboardController::class, 'saveConfig'])->name('dashboard.config');

    // Machines
    Route::get('/machines', [MachineController::class, 'index'])->name('machines.index');
    Route::get('/machines/{machine}', [MachineController::class, 'show'])->name('machines.show');

    // Tags (read-only list for all roles)
    Route::get('/tags', [TagController::class, 'index'])->name('tags.index');

    // Alerts (view + export)
    Route::get('/alerts', [AlertController::class, 'index'])->name('alerts.index');
    Route::get('/alerts/export', [AlertController::class, 'exportCsv'])->name('alerts.export');
    Route::get('/alerts/{alert}', [AlertController::class, 'show'])->name('alerts.show');

    // Exchanges (Elasticsearch full-text search)
    Route::get('/exchanges', [ExchangeController::class, 'index'])->name('exchanges.index');
    Route::get('/exchanges/export', [ExchangeController::class, 'exportCsv'])->name('exchanges.export');
    Route::get('/exchanges/{id}', [ExchangeController::class, 'show'])->name('exchanges.show');

    // Departments (view only)
    Route::get('/departments', [DepartmentController::class, 'index'])->name('departments.index');

    // Deployments (view only)
    Route::get('/deployments', [DeploymentController::class, 'index'])->name('deployments.index');

    // Rules (view only)
    Route::get('/rules', [RuleController::class, 'index'])->name('rules.index');

    // Reports (view)
    Route::get('/reports', [ReportController::class, 'index'])->name('reports.index');

    // Domains (view)
    Route::get('/domains', [DomainController::class, 'index'])->name('domains.index');

    // Audit Logs (view)
    Route::get('/audit', [AuditLogController::class, 'index'])->name('audit.index');

    // Global search
    Route::get('/search', SearchController::class)->name('search');
    Route::get('/search/suggestions', [SearchController::class, 'suggestions'])->name('search.suggestions');

    // Notifications (JSON API)
    Route::get('/notifications', [NotificationController::class, 'index'])->name('notifications.index');
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead'])->name('notifications.read');
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead'])->name('notifications.readAll');
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount'])->name('notifications.unreadCount');

    // Profile & Notification Preferences
    Route::get('/profile', [ProfileController::class, 'index'])->name('profile.index');
    Route::put('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::put('/profile/password', [ProfileController::class, 'updatePassword'])->name('profile.password');
    Route::put('/profile/notifications', [ProfileController::class, 'updateNotifications'])->name('profile.notifications');
    Route::delete('/profile/sessions/{session}', [ProfileController::class, 'revokeSession'])->name('profile.revokeSession');
    Route::delete('/profile/sessions', [ProfileController::class, 'revokeAllSessions'])->name('profile.revokeAllSessions');

    // Two-Factor Authentication management
    Route::post('/two-factor/enable', [TwoFactorController::class, 'enable'])->name('two-factor.enable');
    Route::post('/two-factor/confirm', [TwoFactorController::class, 'confirm'])->name('two-factor.confirm');
    Route::delete('/two-factor/disable', [TwoFactorController::class, 'disable'])->name('two-factor.disable');

    // ── Manager actions (admin + manager) ────────────────────────────

    Route::middleware(['role:manager'])->group(function () {
        // Alerts actions
        Route::post('/alerts/{alert}/acknowledge', [AlertController::class, 'acknowledge'])->name('alerts.acknowledge');
        Route::post('/alerts/{alert}/resolve', [AlertController::class, 'resolve'])->name('alerts.resolve');

        // Machine actions
        Route::put('/machines/{machine}', [MachineController::class, 'update'])->name('machines.update');
        Route::post('/machines/bulk-action', [MachineController::class, 'bulkAction'])->name('machines.bulkAction');
        Route::post('/machines/{machine}/tags', [TagController::class, 'assignToMachine'])->name('machines.tags');
        Route::post('/machines/bulk-tags', [TagController::class, 'bulkAssign'])->name('machines.bulkTags');
        Route::post('/machines/{machine}/force-sync', [MachineController::class, 'forceSyncRules'])->name('machines.forceSync');

        // Tags CRUD
        Route::post('/tags', [TagController::class, 'store'])->name('tags.store');
        Route::put('/tags/{tag}', [TagController::class, 'update'])->name('tags.update');
        Route::delete('/tags/{tag}', [TagController::class, 'destroy'])->name('tags.destroy');
        Route::post('/machines/{machine}/restart', [MachineController::class, 'restartAgent'])->name('machines.restart');
        Route::post('/machines/{machine}/toggle-status', [MachineController::class, 'toggleStatus'])->name('machines.toggleStatus');

        // Departments CRUD
        Route::post('/departments', [DepartmentController::class, 'store'])->name('departments.store');
        Route::put('/departments/{department}', [DepartmentController::class, 'update'])->name('departments.update');
        Route::delete('/departments/{department}', [DepartmentController::class, 'destroy'])->name('departments.destroy');
        Route::post('/departments/{department}/assign-machines', [DepartmentController::class, 'assignMachines'])->name('departments.assignMachines');

        // Rules CRUD
        Route::get('/rules/create', [RuleController::class, 'create'])->name('rules.create');
        Route::post('/rules', [RuleController::class, 'store'])->name('rules.store');
        Route::get('/rules/{rule}/edit', [RuleController::class, 'edit'])->name('rules.edit');
        Route::put('/rules/{rule}', [RuleController::class, 'update'])->name('rules.update');
        Route::delete('/rules/{rule}', [RuleController::class, 'destroy'])->name('rules.destroy');
        Route::post('/rules/{rule}/toggle', [RuleController::class, 'toggleEnabled'])->name('rules.toggle');
        Route::get('/rules/export', [RuleController::class, 'export'])->name('rules.export');
        Route::post('/rules/import', [RuleController::class, 'import'])->name('rules.import');

        // Domains CRUD
        Route::post('/domains', [DomainController::class, 'store'])->name('domains.store');
        Route::put('/domains/{domain}', [DomainController::class, 'update'])->name('domains.update');
        Route::delete('/domains/{domain}', [DomainController::class, 'destroy'])->name('domains.destroy');
        Route::post('/domains/{domain}/toggle', [DomainController::class, 'toggleBlocked'])->name('domains.toggle');

        // Reports export
        Route::get('/reports/export', [ReportController::class, 'exportCsv'])->name('reports.export');
        Route::get('/reports/export-pdf', [ReportController::class, 'exportPdf'])->name('reports.export-pdf');
    });

    // ── Admin only ───────────────────────────────────────────────────

    Route::middleware(['role:admin'])->group(function () {
        // User management
        Route::get('/users', [UserController::class, 'index'])->name('users.index');
        Route::post('/users', [UserController::class, 'store'])->name('users.store');
        Route::put('/users/{user}', [UserController::class, 'update'])->name('users.update');
        Route::delete('/users/{user}', [UserController::class, 'destroy'])->name('users.destroy');

        // Settings
        Route::get('/settings', [SettingController::class, 'index'])->name('settings.index');
        Route::put('/settings', [SettingController::class, 'update'])->name('settings.update');
        Route::get('/settings/agent-versions', [SettingController::class, 'agentVersions'])->name('settings.agentVersions');
    });
});
