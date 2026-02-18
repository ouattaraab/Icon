<?php

namespace App\Console\Commands;

use App\Services\ElasticsearchService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class EsInitCommand extends Command
{
    protected $signature = 'icon:es-init {--force : Delete and recreate if index already exists}';

    protected $description = 'Create the Elasticsearch index with the proper mapping';

    public function handle(ElasticsearchService $elasticsearch): int
    {
        $host = 'http://' . config('icon.elasticsearch.hosts', ['localhost:9200'])[0];
        $index = config('icon.elasticsearch.index', 'icon-exchanges');

        // Check if index already exists
        try {
            $response = Http::head("{$host}/{$index}");
            if ($response->successful()) {
                if ($this->option('force')) {
                    $this->warn("Deleting existing index '{$index}'...");
                    Http::delete("{$host}/{$index}");
                } else {
                    $this->info("Index '{$index}' already exists. Use --force to recreate.");

                    return 0;
                }
            }
        } catch (\Throwable $e) {
            $this->error("Cannot reach Elasticsearch at {$host}: {$e->getMessage()}");

            return 1;
        }

        $this->info("Creating index '{$index}'...");

        if ($elasticsearch->createIndex()) {
            $this->info("Index '{$index}' created successfully.");

            return 0;
        }

        $this->error('Failed to create index. Check logs for details.');

        return 1;
    }
}
