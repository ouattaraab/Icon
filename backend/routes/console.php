<?php

use App\Jobs\PurgeOldEventsJob;
use Illuminate\Support\Facades\Schedule;

/*
|--------------------------------------------------------------------------
| Console Routes (Scheduled Tasks)
|--------------------------------------------------------------------------
|
| Laravel 11 uses routes/console.php for task scheduling.
|
*/

// Detect machines that have gone offline (every 2 minutes)
Schedule::command('icon:detect-offline')
    ->everyTwoMinutes()
    ->withoutOverlapping()
    ->runInBackground();

// Purge old events based on retention policy (daily at 3:00 AM)
Schedule::job(new PurgeOldEventsJob)
    ->dailyAt('03:00')
    ->withoutOverlapping();

// Clean up old read notifications and audit logs (daily at 4:00 AM)
Schedule::command('icon:cleanup')
    ->dailyAt('04:00')
    ->withoutOverlapping();
