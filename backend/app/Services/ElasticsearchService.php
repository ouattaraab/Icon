<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ElasticsearchService
{
    private string $host;
    private string $index = 'icon-exchanges';

    public function __construct()
    {
        $hosts = config('icon.elasticsearch.hosts', ['localhost:9200']);
        $this->host = 'http://' . $hosts[0];
        $this->index = config('icon.elasticsearch.index', 'icon-exchanges');
    }

    /**
     * Index an exchange document and return its Elasticsearch ID
     */
    public function indexExchange(array $data): ?string
    {
        $id = Str::uuid()->toString();

        $data['created_at'] = now()->toISOString();

        try {
            $response = Http::put("{$this->host}/{$this->index}/_doc/{$id}", $data);

            if ($response->successful()) {
                return $id;
            }

            Log::error('Elasticsearch indexing failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
        } catch (\Throwable $e) {
            Log::error('Elasticsearch connection failed', [
                'error' => $e->getMessage(),
            ]);
        }

        return null;
    }

    /**
     * Search exchanges with full-text query
     */
    public function searchExchanges(
        string $query,
        array $filters = [],
        int $from = 0,
        int $size = 20,
    ): array {
        $must = [];
        $filter = [];

        // Full-text search on prompt and response
        if ($query) {
            $must[] = [
                'multi_match' => [
                    'query' => $query,
                    'fields' => ['prompt^2', 'response'],
                    'type' => 'best_fields',
                    'fuzziness' => 'AUTO',
                ],
            ];
        }

        // Apply filters
        if (!empty($filters['platform'])) {
            $filter[] = ['term' => ['platform' => $filters['platform']]];
        }
        if (!empty($filters['machine_id'])) {
            $filter[] = ['term' => ['machine_id' => $filters['machine_id']]];
        }
        if (!empty($filters['severity'])) {
            $filter[] = ['term' => ['severity' => $filters['severity']]];
        }
        if (!empty($filters['date_from'])) {
            $filter[] = ['range' => ['occurred_at' => ['gte' => $filters['date_from']]]];
        }
        if (!empty($filters['date_to'])) {
            $filter[] = ['range' => ['occurred_at' => ['lte' => $filters['date_to']]]];
        }

        $body = [
            'query' => [
                'bool' => [
                    'must' => $must ?: [['match_all' => (object)[]]],
                    'filter' => $filter,
                ],
            ],
            'sort' => [['occurred_at' => 'desc']],
            'from' => $from,
            'size' => $size,
            'highlight' => [
                'fields' => [
                    'prompt' => (object)[],
                    'response' => (object)[],
                ],
                'pre_tags' => ['<mark>'],
                'post_tags' => ['</mark>'],
            ],
        ];

        try {
            $response = Http::post("{$this->host}/{$this->index}/_search", $body);

            if ($response->successful()) {
                $result = $response->json();
                return [
                    'total' => $result['hits']['total']['value'] ?? 0,
                    'hits' => array_map(function ($hit) {
                        return array_merge(
                            $hit['_source'],
                            [
                                'id' => $hit['_id'],
                                'highlights' => $hit['highlight'] ?? [],
                            ]
                        );
                    }, $result['hits']['hits'] ?? []),
                ];
            }
        } catch (\Throwable $e) {
            Log::error('Elasticsearch search failed', ['error' => $e->getMessage()]);
        }

        return ['total' => 0, 'hits' => []];
    }

    /**
     * Get a single exchange by its Elasticsearch ID
     */
    public function getExchange(string $id): ?array
    {
        try {
            $response = Http::get("{$this->host}/{$this->index}/_doc/{$id}");

            if ($response->successful()) {
                $data = $response->json();
                return $data['_source'] ?? null;
            }
        } catch (\Throwable $e) {
            Log::error('Elasticsearch get failed', ['error' => $e->getMessage()]);
        }

        return null;
    }

    /**
     * Bulk delete documents from the index by their IDs.
     * Returns the number of successfully deleted documents.
     */
    public function bulkDelete(array $ids): int
    {
        if (empty($ids)) {
            return 0;
        }

        $body = '';
        foreach ($ids as $id) {
            $body .= json_encode(['delete' => ['_index' => $this->index, '_id' => $id]]) . "\n";
        }

        try {
            $response = Http::withHeaders([
                'Content-Type' => 'application/x-ndjson',
            ])->withBody($body, 'application/x-ndjson')
                ->post("{$this->host}/_bulk");

            if ($response->successful()) {
                $result = $response->json();
                $deleted = 0;
                foreach ($result['items'] ?? [] as $item) {
                    if (isset($item['delete']['result']) && $item['delete']['result'] === 'deleted') {
                        $deleted++;
                    }
                }
                return $deleted;
            }
        } catch (\Throwable $e) {
            Log::error('Elasticsearch bulk delete failed', ['error' => $e->getMessage()]);
        }

        return 0;
    }

    /**
     * Delete old documents from the index based on date range.
     */
    public function deleteByDateRange(string $field, string $before): int
    {
        $body = [
            'query' => [
                'range' => [
                    $field => ['lt' => $before],
                ],
            ],
        ];

        try {
            $response = Http::post("{$this->host}/{$this->index}/_delete_by_query", $body);

            if ($response->successful()) {
                return $response->json('deleted', 0);
            }
        } catch (\Throwable $e) {
            Log::error('Elasticsearch delete by range failed', ['error' => $e->getMessage()]);
        }

        return 0;
    }

    /**
     * Create the index with the proper mapping
     */
    public function createIndex(): bool
    {
        $mapping = $this->getIndexMapping();

        try {
            $response = Http::put("{$this->host}/{$this->index}", $mapping);
            return $response->successful();
        } catch (\Throwable $e) {
            Log::error('Failed to create ES index', ['error' => $e->getMessage()]);
            return false;
        }
    }

    /**
     * Load index mapping from file or return embedded default.
     */
    private function getIndexMapping(): array
    {
        // Try loading from the docker directory (works locally)
        $paths = [
            base_path('../docker/elasticsearch/icon-exchanges-mapping.json'),
            base_path('docker/elasticsearch/icon-exchanges-mapping.json'),
        ];

        foreach ($paths as $path) {
            if (file_exists($path)) {
                return json_decode(file_get_contents($path), true);
            }
        }

        // Embedded fallback mapping (French analyzer for prompt/response search)
        return [
            'settings' => [
                'number_of_shards' => 2,
                'number_of_replicas' => 0,
                'analysis' => [
                    'analyzer' => [
                        'french_custom' => [
                            'type' => 'custom',
                            'tokenizer' => 'standard',
                            'filter' => ['lowercase', 'french_elision', 'french_stop', 'french_stemmer'],
                        ],
                    ],
                    'filter' => [
                        'french_elision' => ['type' => 'elision', 'articles' => ['l','m','t','qu','n','s','j','d','c']],
                        'french_stop' => ['type' => 'stop', 'stopwords' => '_french_'],
                        'french_stemmer' => ['type' => 'stemmer', 'language' => 'french'],
                    ],
                ],
            ],
            'mappings' => [
                'properties' => [
                    'event_id' => ['type' => 'keyword'],
                    'machine_id' => ['type' => 'keyword'],
                    'platform' => ['type' => 'keyword'],
                    'domain' => ['type' => 'keyword'],
                    'event_type' => ['type' => 'keyword'],
                    'prompt' => ['type' => 'text', 'analyzer' => 'french_custom', 'fields' => ['raw' => ['type' => 'keyword', 'ignore_above' => 512]]],
                    'response' => ['type' => 'text', 'analyzer' => 'french_custom'],
                    'content_hash' => ['type' => 'keyword'],
                    'content_length' => ['type' => 'integer'],
                    'matched_rules' => ['type' => 'keyword'],
                    'severity' => ['type' => 'keyword'],
                    'assigned_user' => ['type' => 'keyword'],
                    'department' => ['type' => 'keyword'],
                    'occurred_at' => ['type' => 'date'],
                    'created_at' => ['type' => 'date'],
                ],
            ],
        ];
    }
}
