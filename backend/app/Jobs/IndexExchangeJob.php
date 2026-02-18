<?php

namespace App\Jobs;

use App\Models\Event;
use App\Services\ElasticsearchService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class IndexExchangeJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public array $backoff = [10, 30, 60];
    public int $timeout = 30;

    public function __construct(
        private readonly string $eventId,
        private readonly array $document,
    ) {}

    public function handle(ElasticsearchService $elasticsearch): void
    {
        $esId = $elasticsearch->indexExchange($this->document);

        if ($esId) {
            Event::where('id', $this->eventId)->update(['elasticsearch_id' => $esId]);
        }
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('Failed to index exchange in Elasticsearch', [
            'event_id' => $this->eventId,
            'error' => $exception->getMessage(),
        ]);
    }
}
