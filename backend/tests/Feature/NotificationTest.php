<?php

namespace Tests\Feature;

use App\Events\AlertCreated;
use App\Models\Alert;
use App\Models\Machine;
use App\Models\User;
use App\Notifications\AlertNotification;
use App\Notifications\CriticalAlertNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class NotificationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private Machine $machine;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::create([
            'name' => 'Admin',
            'email' => 'admin@gs2e.ci',
            'password' => 'password',
            'role' => 'admin',
            'notify_critical_alerts' => true,
        ]);

        $this->machine = Machine::create([
            'hostname' => 'NOTIF-PC',
            'os' => 'windows',
            'agent_version' => '0.1.0',
            'api_key_hash' => 'hash',
            'status' => 'active',
        ]);
    }

    public function test_notifications_require_auth(): void
    {
        $this->getJson('/notifications')->assertUnauthorized();
    }

    public function test_notifications_returns_empty(): void
    {
        $this->actingAs($this->admin)->getJson('/notifications')
            ->assertOk()
            ->assertJsonCount(0);
    }

    public function test_notifications_returns_list(): void
    {
        $alert = Alert::create([
            'machine_id' => $this->machine->id,
            'severity' => 'critical',
            'title' => 'Test alerte critique',
            'status' => 'open',
        ]);

        $this->admin->notify(new CriticalAlertNotification($alert));

        $response = $this->actingAs($this->admin)->getJson('/notifications');

        $response->assertOk()
            ->assertJsonCount(1)
            ->assertJsonFragment(['read' => false]);
    }

    public function test_mark_notification_as_read(): void
    {
        $alert = Alert::create([
            'machine_id' => $this->machine->id,
            'severity' => 'critical',
            'title' => 'Test',
            'status' => 'open',
        ]);

        $this->admin->notify(new CriticalAlertNotification($alert));
        $notifId = $this->admin->notifications()->first()->id;

        $this->actingAs($this->admin)
            ->postJson("/notifications/{$notifId}/read")
            ->assertOk();

        $this->assertNotNull($this->admin->notifications()->first()->read_at);
    }

    public function test_mark_all_notifications_as_read(): void
    {
        for ($i = 0; $i < 3; $i++) {
            $alert = Alert::create([
                'machine_id' => $this->machine->id,
                'severity' => 'critical',
                'title' => "Alert {$i}",
                'status' => 'open',
            ]);
            $this->admin->notify(new CriticalAlertNotification($alert));
        }

        $this->assertEquals(3, $this->admin->unreadNotifications()->count());

        $this->actingAs($this->admin)
            ->postJson('/notifications/read-all')
            ->assertOk();

        $this->assertEquals(0, $this->admin->fresh()->unreadNotifications()->count());
    }

    public function test_unread_count_endpoint(): void
    {
        $alert = Alert::create([
            'machine_id' => $this->machine->id,
            'severity' => 'critical',
            'title' => 'Test',
            'status' => 'open',
        ]);
        $this->admin->notify(new CriticalAlertNotification($alert));

        $this->actingAs($this->admin)
            ->getJson('/notifications/unread-count')
            ->assertOk()
            ->assertJson(['count' => 1]);
    }

    public function test_unread_count_shared_via_inertia(): void
    {
        $response = $this->actingAs($this->admin)->get('/');

        $response->assertOk();
        $page = $response->viewData('page');
        $this->assertArrayHasKey('unreadNotificationCount', $page['props']);
    }

    public function test_warning_alert_creates_db_notification(): void
    {
        Notification::fake();

        $manager = User::create([
            'name' => 'Manager',
            'email' => 'manager@gs2e.ci',
            'password' => 'password',
            'role' => 'manager',
        ]);
        $viewer = User::create([
            'name' => 'Viewer',
            'email' => 'viewer@gs2e.ci',
            'password' => 'password',
            'role' => 'viewer',
        ]);

        $alert = Alert::create([
            'machine_id' => $this->machine->id,
            'severity' => 'warning',
            'title' => 'Warning test',
            'status' => 'open',
        ]);

        event(new AlertCreated($alert));

        Notification::assertSentTo([$this->admin, $manager], AlertNotification::class);
        Notification::assertNotSentTo($viewer, AlertNotification::class);
    }

    public function test_critical_alert_creates_mail_and_db_notification(): void
    {
        Notification::fake();

        $alert = Alert::create([
            'machine_id' => $this->machine->id,
            'severity' => 'critical',
            'title' => 'Critical test',
            'status' => 'open',
        ]);

        event(new AlertCreated($alert));

        Notification::assertSentTo($this->admin, CriticalAlertNotification::class, function ($notification, $channels) {
            return in_array('mail', $channels) && in_array('database', $channels);
        });
    }

    public function test_alert_notification_to_array(): void
    {
        $alert = Alert::create([
            'machine_id' => $this->machine->id,
            'severity' => 'warning',
            'title' => 'Test warning',
            'status' => 'open',
        ]);

        $notification = new AlertNotification($alert);
        $data = $notification->toArray($this->admin);

        $this->assertEquals('warning', $data['severity']);
        $this->assertEquals('Test warning', $data['title']);
        $this->assertArrayHasKey('alert_id', $data);
    }

    public function test_notifications_ordered_by_newest_first(): void
    {
        $alert1 = Alert::create([
            'machine_id' => $this->machine->id,
            'severity' => 'critical',
            'title' => 'First',
            'status' => 'open',
        ]);
        $this->admin->notify(new CriticalAlertNotification($alert1));

        $this->travel(1)->minutes();

        $alert2 = Alert::create([
            'machine_id' => $this->machine->id,
            'severity' => 'critical',
            'title' => 'Second',
            'status' => 'open',
        ]);
        $this->admin->notify(new CriticalAlertNotification($alert2));

        $response = $this->actingAs($this->admin)->getJson('/notifications');
        $data = $response->json();

        $this->assertEquals('Second', $data[0]['data']['title']);
        $this->assertEquals('First', $data[1]['data']['title']);
    }

    public function test_mark_read_other_user_notification_ignored(): void
    {
        $user2 = User::create([
            'name' => 'Other',
            'email' => 'other@gs2e.ci',
            'password' => 'password',
            'role' => 'admin',
        ]);

        $alert = Alert::create([
            'machine_id' => $this->machine->id,
            'severity' => 'critical',
            'title' => 'Test',
            'status' => 'open',
        ]);
        $this->admin->notify(new CriticalAlertNotification($alert));
        $notifId = $this->admin->notifications()->first()->id;

        // User2 tries to mark admin's notification as read
        $this->actingAs($user2)
            ->postJson("/notifications/{$notifId}/read")
            ->assertOk();

        // Admin's notification should still be unread
        $this->assertNull($this->admin->notifications()->first()->read_at);
    }

    public function test_alert_notification_only_database_channel(): void
    {
        $alert = Alert::create([
            'machine_id' => $this->machine->id,
            'severity' => 'warning',
            'title' => 'Test',
            'status' => 'open',
        ]);

        $notification = new AlertNotification($alert);
        $channels = $notification->via($this->admin);

        $this->assertEquals(['database'], $channels);
    }
}
