<?php

namespace Database\Seeders;

use App\Models\AgentDeployment;
use App\Models\Alert;
use App\Models\Department;
use App\Models\Event;
use App\Models\Machine;
use Illuminate\Database\Seeder;

class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        $platforms = ['chatgpt', 'claude', 'copilot', 'gemini', 'mistral'];
        $domains = [
            'chatgpt' => 'api.openai.com',
            'claude' => 'api.anthropic.com',
            'copilot' => 'copilot.microsoft.com',
            'gemini' => 'gemini.google.com',
            'mistral' => 'api.mistral.ai',
        ];
        $users = ['Koné A.', 'Traoré M.', 'Diabaté S.', 'Coulibaly F.', 'Bamba K.', 'Yao P.', 'N\'Guessan R.', 'Ouattara H.'];

        // ── 1. Create Departments (if they don't already exist) ──────────
        $departmentDefinitions = [
            ['name' => 'DSI', 'description' => 'Direction des Systèmes d\'Information', 'manager_name' => 'Koné A.'],
            ['name' => 'Ressources Humaines', 'description' => 'Gestion des ressources humaines', 'manager_name' => 'Traoré M.'],
            ['name' => 'Direction Financiere', 'description' => 'Direction financière et comptabilité', 'manager_name' => 'Coulibaly F.'],
            ['name' => 'Direction Commerciale', 'description' => 'Direction commerciale et ventes', 'manager_name' => 'Bamba K.'],
        ];

        $departmentModels = [];
        foreach ($departmentDefinitions as $def) {
            $departmentModels[$def['name']] = Department::firstOrCreate(
                ['name' => $def['name']],
                $def
            );
        }

        // Map each hostname prefix to a department
        $hostnameDeptMap = [
            'DSI' => 'DSI',
            'FIN' => 'Direction Financiere',
            'RH' => 'Ressources Humaines',
            'MKT' => 'Direction Commerciale',
            'DIR' => 'Direction Financiere',
            'COM' => 'Direction Commerciale',
            'JUR' => 'DSI',
        ];

        // ── 2. Create 12 machines with department_id ─────────────────────
        $machines = [];
        $hostnames = [
            'DSI-PC-001', 'DSI-PC-002', 'DSI-MAC-003', 'FIN-PC-004',
            'FIN-PC-005', 'RH-PC-006', 'MKT-MAC-007', 'MKT-PC-008',
            'DIR-MAC-009', 'COM-PC-010', 'JUR-PC-011', 'DSI-PC-012',
        ];

        foreach ($hostnames as $i => $hostname) {
            $os = str_contains($hostname, 'MAC') ? 'macos' : 'windows';
            $prefix = explode('-', $hostname)[0];
            $deptName = $hostnameDeptMap[$prefix] ?? 'DSI';
            $dept = $departmentModels[$deptName];

            $machines[] = Machine::create([
                'hostname' => $hostname,
                'os' => $os,
                'os_version' => $os === 'windows' ? '11.0.22631' : '14.4',
                'agent_version' => '0.1.0',
                'api_key_hash' => bcrypt('demo-key-' . $i),
                'status' => $i < 10 ? 'active' : 'offline',
                'last_heartbeat' => $i < 10 ? now()->subMinutes(rand(0, 4)) : now()->subHours(rand(2, 48)),
                'ip_address' => '192.168.1.' . (100 + $i),
                'department' => $deptName,
                'department_id' => $dept->id,
                'assigned_user' => $users[$i % count($users)],
            ]);
        }

        // Update cached machine counts on each department
        foreach ($departmentModels as $dept) {
            $dept->updateMachineCount();
        }

        // ── 3. Create events spread over last 7 days ─────────────────────
        $eventTypes = ['prompt', 'response', 'block', 'clipboard_alert'];
        $severities = ['info', 'info', 'info', 'warning', 'critical'];

        for ($day = 6; $day >= 0; $day--) {
            $eventsPerDay = rand(15, 40);
            for ($j = 0; $j < $eventsPerDay; $j++) {
                $machine = $machines[array_rand($machines)];
                $platform = $platforms[array_rand($platforms)];
                $eventType = $eventTypes[array_rand($eventTypes)];
                $severity = $eventType === 'block' ? 'critical' : $severities[array_rand($severities)];

                $event = Event::create([
                    'machine_id' => $machine->id,
                    'event_type' => $eventType,
                    'platform' => $platform,
                    'domain' => $domains[$platform],
                    'severity' => $severity,
                    'metadata' => $severity === 'critical' ? ['dlp_matches' => ['credentials' => ['count' => 1]]] : null,
                    'occurred_at' => now()->subDays($day)->subHours(rand(0, 23))->subMinutes(rand(0, 59)),
                ]);

                // Create alerts for warning/critical
                if (in_array($severity, ['warning', 'critical'])) {
                    $statuses = ['open', 'open', 'open', 'acknowledged', 'resolved'];
                    Alert::create([
                        'event_id' => $event->id,
                        'machine_id' => $machine->id,
                        'severity' => $severity,
                        'title' => match ($eventType) {
                            'block' => "Requête bloquée sur {$platform}",
                            'clipboard_alert' => 'Contenu sensible dans le presse-papier',
                            default => "Activité suspecte sur {$platform}",
                        },
                        'description' => "Détecté sur {$machine->hostname} ({$machine->assigned_user})",
                        'status' => $statuses[array_rand($statuses)],
                    ]);
                }
            }
        }

        // ── 4. Create AgentDeployment records ────────────────────────────
        $deploymentMethods = ['auto_update', 'manual', 'gpo', 'mdm'];
        $deploymentStatuses = ['success', 'success', 'success', 'success', 'failed'];

        foreach ($machines as $index => $machine) {
            // Give roughly half the machines a deployment history
            if ($index % 2 !== 0) {
                continue;
            }

            $numDeployments = rand(1, 3);

            for ($d = 0; $d < $numDeployments; $d++) {
                $status = $deploymentStatuses[array_rand($deploymentStatuses)];

                AgentDeployment::create([
                    'machine_id' => $machine->id,
                    'version' => '0.1.' . $d,
                    'previous_version' => $d > 0 ? '0.1.' . ($d - 1) : null,
                    'status' => $status,
                    'deployment_method' => $deploymentMethods[array_rand($deploymentMethods)],
                    'error_message' => $status === 'failed' ? 'Agent process timed out during upgrade' : null,
                    'deployed_at' => now()->subDays(rand(0, 14))->subHours(rand(0, 23)),
                ]);
            }
        }

        $this->command->info('Demo data seeded: '
            . count($departmentModels) . ' departments, '
            . count($machines) . ' machines, '
            . Event::count() . ' events, '
            . Alert::count() . ' alerts, '
            . AgentDeployment::count() . ' deployments.');
    }
}
