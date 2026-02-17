<?php

namespace App\Jobs;

use App\Models\Alert;
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
        $retentionDays = config('icon.agent.event_retention_days', 90);
        $cutoffDate = now()->subDays($retentionDays);

        Log::info("Purging events older than {$retentionDays} days (before {$cutoffDate})");

        // 1. Collect ES IDs for events to be purged
        $esIdsToDelete = Event::where('occurred_at', '<', $cutoffDate)
            ->whereNotNull('elasticsearch_id')
            ->pluck('elasticsearch_id')
            ->toArray();

        // 2. Delete resolved alerts linked to old events
        $deletedAlerts = Alert::where('status', 'resolved')
            ->where('created_at', '<', $cutoffDate)
            ->delete();

        // 3. Delete old events from PostgreSQL
        $deletedEvents = Event::where('occurred_at', '<', $cutoffDate)->delete();

        // 4. Delete from Elasticsearch (in batches of 500)
        $deletedEs = 0;
        foreach (array_chunk($esIdsToDelete, 500) as $batch) {
            $deletedEs += $elasticsearch->bulkDelete($batch);
        }

        Log::info("Purge completed", [
            'deleted_events' => $deletedEvents,
            'deleted_alerts' => $deletedAlerts,
            'deleted_es_docs' => $deletedEs,
            'retention_days' => $retentionDays,
        ]);
    }
}
