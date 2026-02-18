<?php

namespace App\Console\Commands;

use App\Services\ElasticsearchService;
use Illuminate\Console\Command;

class CreateElasticsearchIndexCommand extends Command
{
    protected $signature = 'icon:create-es-index';

    protected $description = 'Create the Elasticsearch index with proper mapping';

    public function handle(ElasticsearchService $elasticsearch): int
    {
        $this->info('Creating Elasticsearch index...');

        if ($elasticsearch->createIndex()) {
            $this->info('Index created successfully.');

            return self::SUCCESS;
        }

        $this->error('Failed to create index. Check logs for details.');

        return self::FAILURE;
    }
}
