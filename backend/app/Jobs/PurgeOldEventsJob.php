<?php

namespace App\Jobs;

use App\Models\Alert;
use App\Models\AuditLog;
use App\Models\Event;
use App\Services\ElasticsearchService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Scheduled job to purge events and alerts older than the retention period.
 * Also cleans up Elasticsearch documents for purged events.
 */
class PurgeOldEventsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;
    public int $timeout = 600; // 10 minutes max

    public function handle(ElasticsearchService $elasticsearch): void
    {
        $eventRetentionDays = config('icon.agent.event_retention_days', 90);
        $alertRetentionDays = config('icon.agent.alert_retention_days', 180);
        $eventCutoff = now()->subDays($eventRetentionDays);
        $alertCutoff = now()->subDays($alertRetentionDays);

        Log::info("Purging events older than {$eventRetentionDays}d, alerts older than {$alertRetentionDays}d");

        // 1. Collect ES IDs for events to be purged
        $esIdsToDelete = Event::where('occurred_at', '<', $eventCutoff)
            ->whereNotNull('elasticsearch_id')
            ->pluck('elasticsearch_id')
            ->toArray();

        // 2. Delete old resolved/acknowledged alerts
        $deletedAlerts = Alert::whereIn('status', ['resolved', 'acknowledged'])
            ->where('created_at', '<', $alertCutoff)
            ->delete();

        // 3. Delete old events from PostgreSQL
        $deletedEvents = Event::where('occurred_at', '<', $eventCutoff)->delete();

        // 4. Delete from Elasticsearch (in batches of 500)
        $deletedEs = 0;
        foreach (array_chunk($esIdsToDelete, 500) as $batch) {
            $deletedEs += $elasticsearch->bulkDelete($batch);
        }

        // 5. Also purge old ES documents by date range
        $deletedEs += $elasticsearch->deleteByDateRange('occurred_at', $eventCutoff->toIso8601String());

        $summary = [
            'deleted_events' => $deletedEvents,
            'deleted_alerts' => $deletedAlerts,
            'deleted_es_docs' => $deletedEs,
            'event_retention_days' => $eventRetentionDays,
            'alert_retention_days' => $alertRetentionDays,
        ];

        Log::info("Purge completed", $summary);

        AuditLog::log('system.purge', 'System', null, $summary);
    }
}
