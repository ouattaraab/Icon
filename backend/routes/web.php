<?php

use App\Http\Controllers\Dashboard\AlertController;
use App\Http\Controllers\Dashboard\ExchangeController;
use App\Http\Controllers\Dashboard\MachineController;
use App\Http\Controllers\Dashboard\ReportController;
use App\Http\Controllers\Dashboard\RuleController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| Dashboard Routes (Inertia/React)
|--------------------------------------------------------------------------
*/

Route::middleware(['auth'])->group(function () {

    // Dashboard home
    Route::get('/', fn () => Inertia::render('Dashboard/Index', [
        'stats' => app(ReportController::class)->index(request())->toResponse(request())->original,
    ]))->name('dashboard');

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
});
