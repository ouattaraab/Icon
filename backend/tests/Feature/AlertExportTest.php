<?php

namespace Tests\Feature;

use App\Models\Alert;
use App\Models\Machine;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AlertExportTest extends TestCase
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

    public function test_export_csv_returns_csv(): void
    {
        $machine = Machine::create([
            'hostname' => 'EXP-PC', 'os' => 'windows',
            'agent_version' => '0.1.0', 'api_key_hash' => 'h', 'status' => 'active',
        ]);

        Alert::create([
            'machine_id' => $machine->id,
            'severity' => 'critical',
            'title' => 'Data leak detected',
            'status' => 'open',
        ]);

        $response = $this->actingAs($this->admin)
            ->get('/alerts/export');

        $response->assertOk();
        $response->assertHeader('content-type', 'text/csv; charset=UTF-8');
        $this->assertStringContains('Data leak detected', $response->streamedContent());
    }

    public function test_export_csv_with_status_filter(): void
    {
        $machine = Machine::create([
            'hostname' => 'EXP-PC', 'os' => 'windows',
            'agent_version' => '0.1.0', 'api_key_hash' => 'h', 'status' => 'active',
        ]);

        Alert::create([
            'machine_id' => $machine->id,
            'severity' => 'critical',
            'title' => 'Open alert',
            'status' => 'open',
        ]);

        Alert::create([
            'machine_id' => $machine->id,
            'severity' => 'warning',
            'title' => 'Resolved alert',
            'status' => 'resolved',
        ]);

        $response = $this->actingAs($this->admin)
            ->get('/alerts/export?status=resolved');

        $content = $response->streamedContent();
        $this->assertStringContains('Resolved alert', $content);
        $this->assertStringNotContains('Open alert', $content);
    }

    public function test_export_csv_with_severity_filter(): void
    {
        $machine = Machine::create([
            'hostname' => 'EXP-PC', 'os' => 'windows',
            'agent_version' => '0.1.0', 'api_key_hash' => 'h', 'status' => 'active',
        ]);

        Alert::create([
            'machine_id' => $machine->id,
            'severity' => 'critical',
            'title' => 'Critical one',
            'status' => 'open',
        ]);

        Alert::create([
            'machine_id' => $machine->id,
            'severity' => 'warning',
            'title' => 'Warning one',
            'status' => 'open',
        ]);

        $response = $this->actingAs($this->admin)
            ->get('/alerts/export?severity=critical');

        $content = $response->streamedContent();
        $this->assertStringContains('Critical one', $content);
        $this->assertStringNotContains('Warning one', $content);
    }

    public function test_export_csv_requires_auth(): void
    {
        $this->get('/alerts/export')->assertRedirect('/login');
    }

    public function test_export_creates_audit_log(): void
    {
        $this->actingAs($this->admin)
            ->get('/alerts/export');

        $this->assertDatabaseHas('audit_logs', ['action' => 'alert.export_csv']);
    }

    private function assertStringContains(string $needle, string $haystack): void
    {
        $this->assertTrue(
            str_contains($haystack, $needle),
            "Failed asserting that string contains '{$needle}'"
        );
    }

    private function assertStringNotContains(string $needle, string $haystack): void
    {
        $this->assertFalse(
            str_contains($haystack, $needle),
            "Failed asserting that string does not contain '{$needle}'"
        );
    }
}
