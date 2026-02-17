<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Agent Configuration
    |--------------------------------------------------------------------------
    |
    | Settings controlling agent communication and behavior.
    |
    */

    'agent' => [
        // Maximum events accepted per batch ingestion
        'max_batch_size' => env('ICON_MAX_BATCH_SIZE', 100),

        // Machine is considered offline after this many seconds without heartbeat
        'offline_threshold_seconds' => env('ICON_OFFLINE_THRESHOLD', 300),

        // Days to retain events in PostgreSQL before archiving
        'event_retention_days' => env('ICON_EVENT_RETENTION_DAYS', 90),

        // Days to retain resolved/acknowledged alerts before purging
        'alert_retention_days' => env('ICON_ALERT_RETENTION_DAYS', 180),

        // Pre-registration key required for initial agent registration
        'registration_key' => env('ICON_REGISTRATION_KEY', ''),

        // Current agent version (served to agents for auto-update check)
        'current_version' => env('ICON_AGENT_VERSION', '0.1.0'),

        // Agent binary download URL template (placeholder: {os}, {arch})
        'update_url' => env('ICON_AGENT_UPDATE_URL', ''),
    ],

    /*
    |--------------------------------------------------------------------------
    | Elasticsearch
    |--------------------------------------------------------------------------
    */

    'elasticsearch' => [
        'hosts' => explode(',', env('ELASTICSEARCH_HOSTS', 'localhost:9200')),
        'index' => env('ELASTICSEARCH_INDEX', 'icon-exchanges'),
        'username' => env('ELASTICSEARCH_USERNAME', ''),
        'password' => env('ELASTICSEARCH_PASSWORD', ''),
    ],

    /*
    |--------------------------------------------------------------------------
    | DLP (Data Loss Prevention)
    |--------------------------------------------------------------------------
    */

    'dlp' => [
        // Enable server-side DLP scanning on ingested events
        'enabled' => env('ICON_DLP_ENABLED', true),

        // Auto-escalate to alert when DLP detects critical patterns
        'auto_alert' => env('ICON_DLP_AUTO_ALERT', true),

        // Maximum content length to scan (bytes). Longer content is truncated.
        'max_scan_length' => env('ICON_DLP_MAX_SCAN_LENGTH', 50000),
    ],

    /*
    |--------------------------------------------------------------------------
    | WebSocket / Real-time
    |--------------------------------------------------------------------------
    */

    'websocket' => [
        // Channel name for rule update broadcasts to agents
        'rules_channel' => 'icon.rules',

        // Channel name for dashboard real-time updates
        'dashboard_channel' => 'icon.dashboard',

        // Channel prefix for per-machine channels
        'machine_channel_prefix' => 'icon.machine.',
    ],

    /*
    |--------------------------------------------------------------------------
    | Security
    |--------------------------------------------------------------------------
    */

    'security' => [
        // HMAC secret used to verify agent request signatures
        'hmac_secret' => env('ICON_HMAC_SECRET', ''),

        // Enable HMAC signature verification on agent API requests
        'verify_signatures' => env('ICON_VERIFY_SIGNATURES', true),

        // Maximum age (seconds) for HMAC timestamp to prevent replay attacks
        'signature_max_age' => env('ICON_SIGNATURE_MAX_AGE', 300),
    ],

];
