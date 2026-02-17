<?php

namespace App\Console\Commands;

use App\Events\MachineStatusChanged;
use App\Models\Alert;
use App\Models\AuditLog;
use App\Models\Machine;
use Illuminate\Console\Command;

/**
 * Detects machines that have not sent a heartbeat within the threshold
 * and marks them as offline. Creates alerts for newly offline machines.
 */
class DetectOfflineMachinesCommand extends Command
{
    protected $signature = 'icon:detect-offline';
    protected $description = 'Detect machines that have gone offline and create alerts';

    public function handle(): int
    {
        $thresholdSeconds = config('icon.agent.offline_threshold_seconds', 300);
        $cutoff = now()->subSeconds($thresholdSeconds);

        $newlyOffline = Machine::where('status', 'active')
            ->where('last_heartbeat', '<', $cutoff)
            ->get();

        foreach ($newlyOffline as $machine) {
            $previousStatus = $machine->status;

            $machine->update(['status' => 'offline']);

            broadcast(new MachineStatusChanged($machine, $previousStatus));

            Alert::create([
                'machine_id' => $machine->id,
                'severity' => 'warning',
                'title' => "Machine « {$machine->hostname} » est hors-ligne",
                'description' => "Dernier contact : {$machine->last_heartbeat->diffForHumans()}. "
                    . "Seuil : {$thresholdSeconds}s.",
                'status' => 'open',
            ]);

            AuditLog::log('machine.offline', 'Machine', $machine->id, [
                'hostname' => $machine->hostname,
                'last_heartbeat' => $machine->last_heartbeat?->toIso8601String(),
            ]);

            $this->warn("Machine {$machine->hostname} marked offline");
        }

        $count = $newlyOffline->count();

        if ($count > 0) {
            $this->info("{$count} machine(s) marked as offline.");
        } else {
            $this->info('All machines are online.');
        }

        return self::SUCCESS;
    }
}
