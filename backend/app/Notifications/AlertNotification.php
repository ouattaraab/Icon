<?php

namespace App\Notifications;

use App\Models\Alert;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class AlertNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public Alert $alert,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'alert_id' => $this->alert->id,
            'severity' => $this->alert->severity,
            'title' => $this->alert->title,
            'machine' => $this->alert->machine?->hostname,
            'rule' => $this->alert->rule?->name,
        ];
    }
}
