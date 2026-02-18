<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

/**
 * Placeholder for handling watchdog alerts received via the API.
 * The actual API endpoint is defined in the routes, this command
 * can be used for testing.
 */
class WatchdogAlertHandlerCommand extends Command
{
    protected $signature = 'icon:test-watchdog {type} {message}';

    protected $description = 'Simulate a watchdog alert for testing';

    public function handle(): int
    {
        $type = $this->argument('type');
        $message = $this->argument('message');

        $this->warn("Watchdog alert [{$type}]: {$message}");

        return self::SUCCESS;
    }
}
