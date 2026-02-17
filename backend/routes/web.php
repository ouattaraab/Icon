<?php

use App\Http\Controllers\Dashboard\AlertController;
use App\Http\Controllers\Dashboard\AuditLogController;
use App\Http\Controllers\Dashboard\DashboardController;
use App\Http\Controllers\Dashboard\DomainController;
use App\Http\Controllers\Dashboard\ExchangeController;
use App\Http\Controllers\Dashboard\MachineController;
use App\Http\Controllers\Dashboard\ReportController;
use App\Http\Controllers\Dashboard\RuleController;
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

    // Dashboard home
    Route::get('/', DashboardController::class)->name('dashboard');

    // Machines
    Route::get('/machines', [MachineController::class, 'index'])->name('machines.index');
    Route::get('/machines/{machine}', [MachineController::class, 'show'])->name('machines.show');

    // Alerts
    Route::get('/alerts', [AlertController::class, 'index'])->name('alerts.index');
    Route::post('/alerts/{alert}/acknowledge', [AlertController::class, 'acknowledge'])->name('alerts.acknowledge');
    Route::post('/alerts/{alert}/resolve', [AlertController::class, 'resolve'])->name('alerts.resolve');

    // Exchanges (Elasticsearch full-text search)
    Route::get('/exchanges', [ExchangeController::class, 'index'])->name('exchanges.index');
    Route::get('/exchanges/{id}', [ExchangeController::class, 'show'])->name('exchanges.show');

    // Rules CRUD
    Route::resource('rules', RuleController::class);
    Route::post('/rules/{rule}/toggle', [RuleController::class, 'toggleEnabled'])->name('rules.toggle');

    // Reports
    Route::get('/reports', [ReportController::class, 'index'])->name('reports.index');
    Route::get('/reports/export', [ReportController::class, 'exportCsv'])->name('reports.export');
    Route::get('/reports/export-pdf', [ReportController::class, 'exportPdf'])->name('reports.export-pdf');

    // Monitored Domains
    Route::get('/domains', [DomainController::class, 'index'])->name('domains.index');
    Route::post('/domains', [DomainController::class, 'store'])->name('domains.store');
    Route::put('/domains/{domain}', [DomainController::class, 'update'])->name('domains.update');
    Route::delete('/domains/{domain}', [DomainController::class, 'destroy'])->name('domains.destroy');
    Route::post('/domains/{domain}/toggle', [DomainController::class, 'toggleBlocked'])->name('domains.toggle');

    // Audit Logs
    Route::get('/audit', [AuditLogController::class, 'index'])->name('audit.index');
});
