<?php

namespace App\Providers;

use App\Events\AlertCreated;
use App\Listeners\SendCriticalAlertNotifications;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Send email notifications for critical alerts
        Event::listen(AlertCreated::class, SendCriticalAlertNotifications::class);

        // Rate limiter for event ingestion: 30 requests/minute per machine
        RateLimiter::for('event-ingestion', function (Request $request) {
            $machine = $request->get('authenticated_machine');
            $key = $machine ? $machine->id : $request->ip();

            return Limit::perMinute(30)->by($key);
        });

        // Rate limiter for watchdog alerts: 10 requests/minute per machine
        RateLimiter::for('watchdog-alerts', function (Request $request) {
            $machine = $request->get('authenticated_machine');
            $key = $machine ? $machine->id : $request->ip();

            return Limit::perMinute(10)->by($key);
        });
    }
}
