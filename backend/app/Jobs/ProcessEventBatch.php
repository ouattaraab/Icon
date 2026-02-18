<?php

namespace App\Jobs;

use App\Events\AlertCreated;
use App\Events\EventsIngested;
use App\Models\Alert;
use App\Models\Event;
use App\Models\Machine;
use App\Services\DlpPatternService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessEventBatch implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 30;

    public function __construct(
        private string $machineId,
        private array $events,
    ) {}

    private int $alertsCreated = 0;

    public function handle(DlpPatternService $dlp): void
    {
        foreach ($this->events as $eventData) {
            try {
                $this->processEvent($eventData, $dlp);
            } catch (\Throwable $e) {
                Log::error('Failed to process event', [
                    'machine_id' => $this->machineId,
                    'event_type' => $eventData['event_type'] ?? 'unknown',
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Broadcast batch summary to dashboard
        $machine = Machine::find($this->machineId);
        $platform = collect($this->events)->pluck('platform')->filter()->first();

        broadcast(new EventsIngested(
            machineId: $this->machineId,
            hostname: $machine?->hostname ?? $this->machineId,
            count: count($this->events),
            alertsCreated: $this->alertsCreated,
            platform: $platform,
        ));
    }

    private function processEvent(array $eventData, DlpPatternService $dlp): void
    {
        // Server-side DLP scan on prompt content
        if (config('icon.dlp.enabled') && ! empty($eventData['prompt_excerpt'])) {
            $scanContent = mb_substr($eventData['prompt_excerpt'], 0, config('icon.dlp.max_scan_length', 50000));
            $dlpResults = $dlp->scan($scanContent);

            if (! empty($dlpResults)) {
                $eventData['metadata'] = json_encode(array_merge(
                    json_decode($eventData['metadata'] ?? '{}', true) ?: [],
                    ['dlp_matches' => $dlpResults],
                ));

                // Escalate severity if DLP finds critical patterns
                if (config('icon.dlp.auto_alert') && $dlp->highestSeverity($dlpResults) === 'critical') {
                    $eventData['severity'] = 'critical';
                }
            }
        }

        // Store metadata in PostgreSQL
        $event = Event::create([
            'machine_id' => $this->machineId,
            'event_type' => $eventData['event_type'],
            'platform' => $eventData['platform'] ?? null,
            'domain' => $eventData['domain'] ?? null,
            'rule_id' => $eventData['rule_id'] ?? null,
            'severity' => $eventData['severity'] ?? 'info',
            'metadata' => ! empty($eventData['metadata']) ? json_decode($eventData['metadata'], true) : null,
            'occurred_at' => $eventData['occurred_at'],
        ]);

        // Dispatch Elasticsearch indexing as a separate job
        if (! empty($eventData['prompt_excerpt']) || ! empty($eventData['response_excerpt'])) {
            IndexExchangeJob::dispatch($event->id, [
                'machine_id' => $this->machineId,
                'platform' => $eventData['platform'] ?? null,
                'domain' => $eventData['domain'] ?? null,
                'event_type' => $eventData['event_type'],
                'prompt' => $eventData['prompt_excerpt'] ?? null,
                'response' => $eventData['response_excerpt'] ?? null,
                'content_hash' => $eventData['content_hash'] ?? null,
                'content_length' => strlen($eventData['prompt_excerpt'] ?? ''),
                'matched_rules' => ! empty($eventData['rule_id']) ? [$eventData['rule_id']] : [],
                'severity' => $eventData['severity'] ?? 'info',
                'occurred_at' => $eventData['occurred_at'],
            ]);
        }

        // Generate alerts for block/critical events
        if (in_array($eventData['severity'] ?? '', ['warning', 'critical'])) {
            $alert = Alert::create([
                'event_id' => $event->id,
                'machine_id' => $this->machineId,
                'rule_id' => $eventData['rule_id'] ?? null,
                'severity' => $eventData['severity'],
                'title' => $this->generateAlertTitle($eventData),
                'description' => $eventData['prompt_excerpt'] ?? null,
                'status' => 'open',
            ]);

            broadcast(new AlertCreated($alert));
            $this->alertsCreated++;
        }
    }

    private function generateAlertTitle(array $eventData): string
    {
        $platform = $eventData['platform'] ?? 'IA';
        $type = $eventData['event_type'] ?? 'event';

        return match ($type) {
            'block' => "Requête bloquée sur {$platform}",
            'clipboard_block' => 'Contenu sensible détecté dans le presse-papier',
            'clipboard_alert' => 'Alerte presse-papier : pattern sensible détecté',
            default => "Activité {$type} détectée sur {$platform}",
        };
    }
}
