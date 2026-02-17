<?php

namespace Database\Seeders;

use App\Models\Alert;
use App\Models\Event;
use App\Models\Machine;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

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
        $departments = ['DSI', 'Finance', 'RH', 'Marketing', 'Direction', 'Commercial', 'Juridique'];
        $users = ['Koné A.', 'Traoré M.', 'Diabaté S.', 'Coulibaly F.', 'Bamba K.', 'Yao P.', 'N\'Guessan R.', 'Ouattara H.'];

        // Create 12 machines
        $machines = [];
        $osTypes = ['windows', 'macos'];
        $hostnames = [
            'DSI-PC-001', 'DSI-PC-002', 'DSI-MAC-003', 'FIN-PC-004',
            'FIN-PC-005', 'RH-PC-006', 'MKT-MAC-007', 'MKT-PC-008',
            'DIR-MAC-009', 'COM-PC-010', 'JUR-PC-011', 'DSI-PC-012',
        ];

        foreach ($hostnames as $i => $hostname) {
            $os = str_contains($hostname, 'MAC') ? 'macos' : 'windows';
            $machines[] = Machine::create([
                'hostname' => $hostname,
                'os' => $os,
                'os_version' => $os === 'windows' ? '11.0.22631' : '14.4',
                'agent_version' => '0.1.0',
                'api_key_hash' => bcrypt('demo-key-' . $i),
                'status' => $i < 10 ? 'active' : 'offline',
                'last_heartbeat' => $i < 10 ? now()->subMinutes(rand(0, 4)) : now()->subHours(rand(2, 48)),
                'ip_address' => '192.168.1.' . (100 + $i),
                'department' => $departments[$i % count($departments)],
                'assigned_user' => $users[$i % count($users)],
            ]);
        }

        // Create events spread over last 7 days
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
                            'clipboard_alert' => "Contenu sensible dans le presse-papier",
                            default => "Activité suspecte sur {$platform}",
                        },
                        'description' => "Détecté sur {$machine->hostname} ({$machine->assigned_user})",
                        'status' => $statuses[array_rand($statuses)],
                    ]);
                }
            }
        }

        $this->command->info('Demo data seeded: ' . count($machines) . ' machines, '
            . Event::count() . ' events, ' . Alert::count() . ' alerts.');
    }
}
