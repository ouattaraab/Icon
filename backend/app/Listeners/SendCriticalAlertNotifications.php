<?php

namespace App\Listeners;

use App\Events\AlertCreated;
use App\Models\User;
use App\Notifications\CriticalAlertNotification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Notification;

class SendCriticalAlertNotifications implements ShouldQueue
{
    public function handle(AlertCreated $event): void
    {
        // Only notify for critical alerts
        if ($event->alert->severity !== 'critical') {
            return;
        }

        // Load machine relationship for the notification
        $event->alert->loadMissing(['machine', 'rule']);

        // Send to all users who opted in for critical alert notifications
        $recipients = User::where('notify_critical_alerts', true)->get();

        if ($recipients->isEmpty()) {
            // Fallback: notify all admins
            $recipients = User::where('role', 'admin')->get();
        }

        if ($recipients->isNotEmpty()) {
            Notification::send($recipients, new CriticalAlertNotification($event->alert));
        }
    }
}
