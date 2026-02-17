<?php

namespace App\Listeners;

use App\Events\AlertCreated;
use App\Models\User;
use App\Notifications\AlertNotification;
use App\Notifications\CriticalAlertNotification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Notification;

class SendCriticalAlertNotifications implements ShouldQueue
{
    public function handle(AlertCreated $event): void
    {
        $event->alert->loadMissing(['machine', 'rule']);

        if ($event->alert->severity === 'critical') {
            // Critical: email + database notification to opted-in users (or fallback to admins)
            $recipients = User::where('notify_critical_alerts', true)->get();

            if ($recipients->isEmpty()) {
                $recipients = User::where('role', 'admin')->get();
            }

            if ($recipients->isNotEmpty()) {
                Notification::send($recipients, new CriticalAlertNotification($event->alert));
            }
        } elseif ($event->alert->severity === 'warning') {
            // Warning: database-only notification to admins and managers
            $recipients = User::whereIn('role', ['admin', 'manager'])->get();

            if ($recipients->isNotEmpty()) {
                Notification::send($recipients, new AlertNotification($event->alert));
            }
        }
    }
}
