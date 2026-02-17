<?php

namespace Tests\Feature;

use App\Events\AlertCreated;
use App\Listeners\SendCriticalAlertNotifications;
use App\Models\Alert;
use App\Models\Machine;
use App\Models\User;
use App\Notifications\CriticalAlertNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class CriticalAlertNotificationTest extends TestCase
{
    use RefreshDatabase;

    private Machine $machine;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->machine = Machine::create([
            'hostname' => 'TEST-PC',
            'os' => 'windows',
            'agent_version' => '0.1.0',
            'api_key_hash' => 'hash',
            'status' => 'active',
        ]);

        $this->admin = User::create([
            'name' => 'Admin',
            'email' => 'admin@gs2e.ci',
            'password' => 'password',
            'role' => 'admin',
        ]);
    }

    public function test_critical_alert_sends_notification_to_opted_in_users(): void
    {
        Notification::fake();

        $subscriber = User::create([
            'name' => 'Subscriber',
            'email' => 'sub@gs2e.ci',
            'password' => 'password',
            'role' => 'manager',
            'notify_critical_alerts' => true,
        ]);

        $alert = Alert::create([
            'machine_id' => $this->machine->id,
            'severity' => 'critical',
            'title' => 'Requête bloquée sur ChatGPT',
            'status' => 'open',
        ]);

        $listener = new SendCriticalAlertNotifications();
        $listener->handle(new AlertCreated($alert));

        Notification::assertSentTo($subscriber, CriticalAlertNotification::class);
    }

    public function test_warning_alert_does_not_send_notification(): void
    {
        Notification::fake();

        User::create([
            'name' => 'Subscriber',
            'email' => 'sub@gs2e.ci',
            'password' => 'password',
            'role' => 'manager',
            'notify_critical_alerts' => true,
        ]);

        $alert = Alert::create([
            'machine_id' => $this->machine->id,
            'severity' => 'warning',
            'title' => 'Alerte mineure',
            'status' => 'open',
        ]);

        $listener = new SendCriticalAlertNotifications();
        $listener->handle(new AlertCreated($alert));

        Notification::assertNothingSent();
    }

    public function test_fallback_to_admins_when_no_opted_in_users(): void
    {
        Notification::fake();

        // No one has notify_critical_alerts = true
        $alert = Alert::create([
            'machine_id' => $this->machine->id,
            'severity' => 'critical',
            'title' => 'Alerte critique sans abonnés',
            'status' => 'open',
        ]);

        $listener = new SendCriticalAlertNotifications();
        $listener->handle(new AlertCreated($alert));

        // Should fall back to admin
        Notification::assertSentTo($this->admin, CriticalAlertNotification::class);
    }

    public function test_notification_not_sent_to_non_opted_in_users(): void
    {
        Notification::fake();

        $viewer = User::create([
            'name' => 'Viewer',
            'email' => 'viewer@gs2e.ci',
            'password' => 'password',
            'role' => 'viewer',
            'notify_critical_alerts' => false,
        ]);

        $subscriber = User::create([
            'name' => 'Subscriber',
            'email' => 'sub@gs2e.ci',
            'password' => 'password',
            'role' => 'manager',
            'notify_critical_alerts' => true,
        ]);

        $alert = Alert::create([
            'machine_id' => $this->machine->id,
            'severity' => 'critical',
            'title' => 'Test',
            'status' => 'open',
        ]);

        $listener = new SendCriticalAlertNotifications();
        $listener->handle(new AlertCreated($alert));

        Notification::assertSentTo($subscriber, CriticalAlertNotification::class);
        Notification::assertNotSentTo($viewer, CriticalAlertNotification::class);
    }

    public function test_notification_contains_correct_data(): void
    {
        $alert = Alert::create([
            'machine_id' => $this->machine->id,
            'severity' => 'critical',
            'title' => 'Données sensibles détectées',
            'description' => 'Un mot de passe a été envoyé à ChatGPT',
            'status' => 'open',
        ]);
        $alert->load('machine');

        $notification = new CriticalAlertNotification($alert);
        $data = $notification->toArray($this->admin);

        $this->assertEquals($alert->id, $data['alert_id']);
        $this->assertEquals('critical', $data['severity']);
        $this->assertEquals('Données sensibles détectées', $data['title']);
        $this->assertEquals('TEST-PC', $data['machine']);
    }

    public function test_notification_mail_has_correct_subject(): void
    {
        $alert = Alert::create([
            'machine_id' => $this->machine->id,
            'severity' => 'critical',
            'title' => 'Requête bloquée',
            'status' => 'open',
        ]);
        $alert->load('machine');

        $notification = new CriticalAlertNotification($alert);
        $mail = $notification->toMail($this->admin);

        $this->assertStringContainsString('Alerte critique', $mail->subject);
        $this->assertStringContainsString('Requête bloquée', $mail->subject);
    }

    public function test_user_notify_critical_alerts_field(): void
    {
        $user = User::create([
            'name' => 'Test',
            'email' => 'test@gs2e.ci',
            'password' => 'password',
            'role' => 'viewer',
            'notify_critical_alerts' => true,
        ]);

        $this->assertTrue($user->notify_critical_alerts);

        $user->update(['notify_critical_alerts' => false]);
        $user->refresh();
        $this->assertFalse($user->notify_critical_alerts);
    }
}
