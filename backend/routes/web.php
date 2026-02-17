<?php

use App\Http\Controllers\Dashboard\AlertController;
use App\Http\Controllers\Dashboard\AuditLogController;
use App\Http\Controllers\Dashboard\DashboardController;
use App\Http\Controllers\Dashboard\DomainController;
use App\Http\Controllers\Dashboard\ExchangeController;
use App\Http\Controllers\Dashboard\MachineController;
use App\Http\Controllers\Dashboard\ProfileController;
use App\Http\Controllers\Dashboard\ReportController;
use App\Http\Controllers\Dashboard\RuleController;
use App\Http\Controllers\Dashboard\SettingController;
use App\Http\Controllers\Dashboard\UserController;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

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
        $request->session()->regenerate();
        AuditLog::log('auth.login', 'User', (string) Auth::id(), [
            'email' => Auth::user()->email,
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

/*
|--------------------------------------------------------------------------
| Dashboard Routes (Inertia/React)
|--------------------------------------------------------------------------
*/

Route::middleware(['auth'])->group(function () {

    // ── Read-only pages (all roles) ──────────────────────────────────

    // Dashboard home
    Route::get('/', DashboardController::class)->name('dashboard');

    // Machines
    Route::get('/machines', [MachineController::class, 'index'])->name('machines.index');
    Route::get('/machines/{machine}', [MachineController::class, 'show'])->name('machines.show');

    // Alerts (view)
    Route::get('/alerts', [AlertController::class, 'index'])->name('alerts.index');

    // Exchanges (Elasticsearch full-text search)
    Route::get('/exchanges', [ExchangeController::class, 'index'])->name('exchanges.index');
    Route::get('/exchanges/{id}', [ExchangeController::class, 'show'])->name('exchanges.show');

    // Rules (view only)
    Route::get('/rules', [RuleController::class, 'index'])->name('rules.index');

    // Reports (view)
    Route::get('/reports', [ReportController::class, 'index'])->name('reports.index');

    // Domains (view)
    Route::get('/domains', [DomainController::class, 'index'])->name('domains.index');

    // Audit Logs (view)
    Route::get('/audit', [AuditLogController::class, 'index'])->name('audit.index');

    // Profile & Notification Preferences
    Route::get('/profile', [ProfileController::class, 'index'])->name('profile.index');
    Route::put('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::put('/profile/password', [ProfileController::class, 'updatePassword'])->name('profile.password');
    Route::put('/profile/notifications', [ProfileController::class, 'updateNotifications'])->name('profile.notifications');

    // ── Manager actions (admin + manager) ────────────────────────────

    Route::middleware(['role:manager'])->group(function () {
        // Alerts actions
        Route::post('/alerts/{alert}/acknowledge', [AlertController::class, 'acknowledge'])->name('alerts.acknowledge');
        Route::post('/alerts/{alert}/resolve', [AlertController::class, 'resolve'])->name('alerts.resolve');

        // Machine actions
        Route::post('/machines/{machine}/force-sync', [MachineController::class, 'forceSyncRules'])->name('machines.forceSync');
        Route::post('/machines/{machine}/restart', [MachineController::class, 'restartAgent'])->name('machines.restart');
        Route::post('/machines/{machine}/toggle-status', [MachineController::class, 'toggleStatus'])->name('machines.toggleStatus');

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
    });
});
