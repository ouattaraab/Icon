<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AlertController extends Controller
{
    public function index(Request $request): Response
    {
        $alerts = Alert::with(['machine:id,hostname', 'rule:id,name'])
            ->when($request->query('status'), fn ($q, $status) => $q->where('status', $status))
            ->when($request->query('severity'), fn ($q, $sev) => $q->where('severity', $sev))
            ->when($request->query('machine_id'), fn ($q, $id) => $q->where('machine_id', $id))
            ->orderBy('created_at', 'desc')
            ->paginate(25);

        $openCount = Alert::where('status', 'open')->count();
        $criticalCount = Alert::where('status', 'open')->where('severity', 'critical')->count();

        return Inertia::render('Alerts/Index', [
            'alerts' => $alerts,
            'openCount' => $openCount,
            'criticalCount' => $criticalCount,
            'filters' => $request->only(['status', 'severity', 'machine_id']),
        ]);
    }

    public function acknowledge(Alert $alert): \Illuminate\Http\RedirectResponse
    {
        $alert->update([
            'status' => 'acknowledged',
            'acknowledged_by' => auth()->id(),
            'acknowledged_at' => now(),
        ]);

        AuditLog::log('alert.acknowledged', 'Alert', $alert->id);

        return back();
    }

    public function resolve(Alert $alert): \Illuminate\Http\RedirectResponse
    {
        $alert->update(['status' => 'resolved']);

        AuditLog::log('alert.resolved', 'Alert', $alert->id);

        return back();
    }

    public function exportCsv(Request $request): StreamedResponse
    {
        $query = Alert::with(['machine:id,hostname', 'rule:id,name'])
            ->when($request->query('status'), fn ($q, $status) => $q->where('status', $status))
            ->when($request->query('severity'), fn ($q, $sev) => $q->where('severity', $sev))
            ->when($request->query('machine_id'), fn ($q, $id) => $q->where('machine_id', $id))
            ->orderBy('created_at', 'desc');

        $filename = 'icon-alertes-' . now()->format('Y-m-d') . '.csv';

        AuditLog::log('alert.export_csv', 'Alert', null, [
            'filters' => $request->only(['status', 'severity', 'machine_id']),
        ]);

        return response()->streamDownload(function () use ($query) {
            $out = fopen('php://output', 'w');
            fprintf($out, chr(0xEF) . chr(0xBB) . chr(0xBF));

            fputcsv($out, [
                'Date', 'Sévérité', 'Titre', 'Description', 'Statut',
                'Machine', 'Règle', 'Prise en charge le',
            ], ';');

            $query->chunk(500, function ($alerts) use ($out) {
                foreach ($alerts as $alert) {
                    fputcsv($out, [
                        $alert->created_at?->format('Y-m-d H:i:s'),
                        $alert->severity,
                        $alert->title,
                        $alert->description ?? '',
                        $alert->status,
                        $alert->machine?->hostname ?? '',
                        $alert->rule?->name ?? '',
                        $alert->acknowledged_at?->format('Y-m-d H:i:s') ?? '',
                    ], ';');
                }
            });

            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
