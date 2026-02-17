<?php

namespace Tests\Feature;

use App\Http\Controllers\Dashboard\DashboardController;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardConfigTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::create([
            'name' => 'Admin', 'email' => 'admin@gs2e.ci',
            'password' => 'password', 'role' => 'admin',
        ]);
    }

    public function test_dashboard_includes_default_config(): void
    {
        $response = $this->actingAs($this->admin)->get('/');
        $response->assertOk();

        $page = $response->viewData('page');
        $config = $page['props']['dashboardConfig'];
        $this->assertArrayHasKey('widgets', $config);
        $this->assertCount(7, $config['widgets']);
    }

    public function test_save_dashboard_config(): void
    {
        $widgets = [
            ['id' => 'stats', 'visible' => true, 'order' => 0],
            ['id' => 'activity24h', 'visible' => false, 'order' => 1],
            ['id' => 'platformUsage', 'visible' => true, 'order' => 2],
            ['id' => 'dailyEvents', 'visible' => false, 'order' => 3],
            ['id' => 'departmentStats', 'visible' => true, 'order' => 4],
            ['id' => 'recentAlerts', 'visible' => true, 'order' => 5],
            ['id' => 'topMachines', 'visible' => true, 'order' => 6],
        ];

        $this->actingAs($this->admin)
            ->putJson('/dashboard/config', ['widgets' => $widgets])
            ->assertOk()
            ->assertJson(['ok' => true]);

        $this->admin->refresh();
        $this->assertFalse($this->admin->dashboard_config['widgets'][1]['visible']);
    }

    public function test_save_config_validates_widgets(): void
    {
        $this->actingAs($this->admin)
            ->putJson('/dashboard/config', ['widgets' => 'invalid'])
            ->assertUnprocessable();
    }

    public function test_save_config_validates_widget_structure(): void
    {
        $this->actingAs($this->admin)
            ->putJson('/dashboard/config', [
                'widgets' => [['id' => 'stats']], // missing visible and order
            ])
            ->assertUnprocessable();
    }

    public function test_saved_config_is_returned_on_dashboard(): void
    {
        $widgets = [
            ['id' => 'stats', 'visible' => false, 'order' => 6],
            ['id' => 'activity24h', 'visible' => true, 'order' => 5],
            ['id' => 'platformUsage', 'visible' => true, 'order' => 4],
            ['id' => 'dailyEvents', 'visible' => true, 'order' => 3],
            ['id' => 'departmentStats', 'visible' => true, 'order' => 2],
            ['id' => 'recentAlerts', 'visible' => true, 'order' => 1],
            ['id' => 'topMachines', 'visible' => true, 'order' => 0],
        ];

        $this->admin->update(['dashboard_config' => ['widgets' => $widgets]]);

        $response = $this->actingAs($this->admin)->get('/');
        $page = $response->viewData('page');
        $config = $page['props']['dashboardConfig'];

        $this->assertFalse($config['widgets'][0]['visible']);
        $this->assertEquals('stats', $config['widgets'][0]['id']);
    }

    public function test_save_config_requires_auth(): void
    {
        $this->putJson('/dashboard/config', ['widgets' => []])
            ->assertUnauthorized();
    }

    public function test_default_config_has_all_widgets_visible(): void
    {
        $config = DashboardController::defaultConfig();

        foreach ($config['widgets'] as $widget) {
            $this->assertTrue($widget['visible'], "Widget {$widget['id']} should be visible by default");
        }
    }
}
