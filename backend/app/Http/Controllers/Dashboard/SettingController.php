<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Machine;
use App\Models\Setting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class SettingController extends Controller
{
    private const SETTING_KEYS = [
        'event_retention_days',
        'alert_retention_days',
        'offline_threshold_seconds',
        'max_batch_size',
        'dlp_enabled',
        'dlp_auto_alert',
        'dlp_max_scan_length',
        'agent_registration_key',
        'agent_current_version',
        'agent_update_url',
        'verify_signatures',
    ];

    private const DEFAULTS = [
        'event_retention_days' => '90',
        'alert_retention_days' => '180',
        'offline_threshold_seconds' => '300',
        'max_batch_size' => '100',
        'dlp_enabled' => '1',
        'dlp_auto_alert' => '1',
        'dlp_max_scan_length' => '50000',
        'agent_registration_key' => '',
        'agent_current_version' => '0.1.0',
        'agent_update_url' => '',
        'verify_signatures' => '1',
    ];

    public function index(): Response
    {
        $settings = Setting::getMany(self::SETTING_KEYS, self::DEFAULTS);

        return Inertia::render('Settings/Index', [
            'settings' => $settings,
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'event_retention_days' => 'required|integer|min:7|max:3650',
            'alert_retention_days' => 'required|integer|min:7|max:3650',
            'offline_threshold_seconds' => 'required|integer|min:60|max:3600',
            'max_batch_size' => 'required|integer|min:10|max:1000',
            'dlp_enabled' => 'required|boolean',
            'dlp_auto_alert' => 'required|boolean',
            'dlp_max_scan_length' => 'required|integer|min:1000|max:500000',
            'agent_registration_key' => 'nullable|string|max:255',
            'agent_current_version' => 'required|string|max:50',
            'agent_update_url' => 'nullable|string|max:500',
            'verify_signatures' => 'required|boolean',
        ]);

        $changes = [];
        foreach ($validated as $key => $value) {
            $oldValue = Setting::getValue($key, self::DEFAULTS[$key] ?? null);
            $newValue = is_bool($value) ? ($value ? '1' : '0') : (string) $value;

            if ($oldValue !== $newValue) {
                $changes[$key] = ['old' => $oldValue, 'new' => $newValue];
            }

            Setting::setValue($key, $newValue);
        }

        if (! empty($changes)) {
            AuditLog::log('settings.updated', 'Settings', null, $changes);
        }

        return redirect()->back()->with('success', 'Paramètres enregistrés.');
    }

    public function agentVersions(): Response
    {
        $targetVersion = Setting::getValue('agent_current_version', '0.1.0');
        $updateUrl = Setting::getValue('agent_update_url', '');

        // Version distribution across machines
        $versionDistribution = Machine::whereNotNull('agent_version')
            ->select('agent_version', DB::raw('COUNT(*) as count'))
            ->groupBy('agent_version')
            ->orderByDesc('count')
            ->get()
            ->map(fn ($row) => [
                'version' => $row->agent_version,
                'count' => (int) $row->count,
                'is_current' => $row->agent_version === $targetVersion,
            ]);

        $totalMachines = Machine::count();
        $upToDate = Machine::where('agent_version', $targetVersion)->count();
        $outdated = $totalMachines - $upToDate;

        // Machines with outdated agents (details)
        $outdatedMachines = Machine::where(function ($q) use ($targetVersion) {
            $q->where('agent_version', '!=', $targetVersion)
                ->orWhereNull('agent_version');
        })
            ->select('id', 'hostname', 'os', 'agent_version', 'status', 'last_heartbeat', 'department')
            ->orderBy('hostname')
            ->limit(50)
            ->get()
            ->map(fn ($m) => [
            'id' => $m->id,
            'hostname' => $m->hostname,
            'os' => $m->os,
            'agent_version' => $m->agent_version,
            'status' => $m->isOnline() ? 'online' : $m->status,
            'last_heartbeat' => $m->last_heartbeat?->diffForHumans(),
            'department' => $m->department,
        ]);

        return Inertia::render('Settings/AgentVersions', [
            'targetVersion' => $targetVersion,
            'updateUrl' => $updateUrl,
            'versionDistribution' => $versionDistribution,
            'totalMachines' => $totalMachines,
            'upToDate' => $upToDate,
            'outdated' => $outdated,
            'outdatedMachines' => $outdatedMachines,
        ]);
    }
}
