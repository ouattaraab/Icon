<?php

namespace App\Notifications;

use App\Models\Alert;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class CriticalAlertNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public Alert $alert,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $machine = $this->alert->machine?->hostname ?? 'Inconnue';
        $rule = $this->alert->rule?->name ?? '-';

        return (new MailMessage)
            ->subject("[Icon] Alerte critique : {$this->alert->title}")
            ->greeting("Alerte critique détectée")
            ->line("**Machine** : {$machine}")
            ->line("**Titre** : {$this->alert->title}")
            ->line("**Règle** : {$rule}")
            ->line("**Date** : {$this->alert->created_at->format('d/m/Y H:i:s')}")
            ->when($this->alert->description, function (MailMessage $mail) {
                $excerpt = mb_substr($this->alert->description, 0, 200);
                $mail->line("**Détail** : {$excerpt}...");
            })
            ->action('Voir les alertes', url('/alerts'))
            ->salutation('— Icon Monitoring IA');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'alert_id' => $this->alert->id,
            'severity' => $this->alert->severity,
            'title' => $this->alert->title,
            'machine' => $this->alert->machine?->hostname,
        ];
    }
}
