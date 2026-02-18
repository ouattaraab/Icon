#!/usr/bin/env php
<?php
/**
 * Icon Agent E2E Simulation Script
 *
 * Simulates a complete agent lifecycle: registration -> heartbeat -> rule sync
 * -> domain sync -> event ingestion -> sustained heartbeats.
 *
 * Usage: php simulate_agent.php [server_url] [enrollment_key]
 * Default server: http://localhost:8000
 *
 * Exit codes:
 *   0 - All steps passed
 *   1 - One or more steps failed
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

$serverUrl     = rtrim($argv[1] ?? 'http://localhost:8000', '/');
$enrollmentKey = $argv[2] ?? '';
$agentVersion  = '0.2.0';
$hostname      = 'E2E-TEST-' . strtoupper(substr(md5(uniqid()), 0, 6));
$os            = PHP_OS_FAMILY === 'Darwin' ? 'macos' : 'windows';
$osVersion     = php_uname('r');

// Credentials populated after registration
$machineId  = null;
$apiKey     = null;
$hmacSecret = null;

// Results tracker
$results = [];

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Compute HMAC-SHA256 signature of a payload.
 */
function hmac_sign(string $payload, string $secret): string
{
    return hash_hmac('sha256', $payload, $secret);
}

/**
 * Send an authenticated API request.
 *
 * For POST requests the body is JSON-encoded, the X-Signature HMAC header is
 * computed automatically, and an X-Timestamp header is included.
 *
 * For GET requests, $data is ignored (query params should be in the URL).
 *
 * @param  string      $method     HTTP method (GET|POST)
 * @param  string      $url        Full URL
 * @param  array|null  $data       Request body (POST only)
 * @param  string|null $apiKey     X-Api-Key value
 * @param  string|null $hmacSecret HMAC secret for signature
 * @param  array       $extraHeaders Additional headers
 * @return array{int, array|null}  [httpCode, decodedBody]
 */
function api_request(
    string $method,
    string $url,
    ?array $data = null,
    ?string $apiKey = null,
    ?string $hmacSecret = null,
    array $extraHeaders = []
): array {
    $ch = curl_init();

    $headers = [
        'Accept: application/json',
        'Content-Type: application/json',
    ];

    if ($apiKey !== null) {
        $headers[] = 'X-Api-Key: ' . $apiKey;
    }

    $headers[] = 'X-Timestamp: ' . time();

    foreach ($extraHeaders as $h) {
        $headers[] = $h;
    }

    $body = null;
    if ($method === 'POST' && $data !== null) {
        $body = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($hmacSecret !== null) {
            $headers[] = 'X-Signature: ' . hmac_sign($body, $hmacSecret);
        }
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    }

    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_FOLLOWLOCATION => true,
    ]);

    $response = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        return [0, ['curl_error' => $curlError]];
    }

    $decoded = json_decode($response, true);

    return [$httpCode, $decoded];
}

/**
 * Print a formatted result line and record it.
 */
function print_result(string $step, bool $success, string $message): void
{
    global $results;
    $icon = $success ? '[PASS]' : '[FAIL]';
    $color = $success ? "\033[32m" : "\033[31m";
    $reset = "\033[0m";

    fprintf(STDOUT, "%s%s%s %s: %s\n", $color, $icon, $reset, $step, $message);

    $results[] = [
        'step'    => $step,
        'success' => $success,
        'message' => $message,
    ];
}

/**
 * Print a section header.
 */
function section(string $title): void
{
    $line = str_repeat('-', 60);
    fprintf(STDOUT, "\n\033[1;36m%s\n  %s\n%s\033[0m\n", $line, $title, $line);
}

// ---------------------------------------------------------------------------
// 0. Health Check
// ---------------------------------------------------------------------------

section('Step 0: Health Check');

[$code, $body] = api_request('GET', "$serverUrl/api/health");

if ($code === 200 && isset($body['status']) && $body['status'] === 'ok') {
    print_result('Health Check', true, "Server is reachable at $serverUrl (status: ok)");
} else {
    print_result('Health Check', false, "Server unreachable or unexpected response (HTTP $code)");
    fprintf(STDERR, "Cannot reach the server. Aborting.\n");
    exit(1);
}

// ---------------------------------------------------------------------------
// 1. Registration
// ---------------------------------------------------------------------------

section('Step 1: Agent Registration');

$regPayload = [
    'hostname'      => $hostname,
    'os'            => $os,
    'os_version'    => $osVersion,
    'agent_version' => $agentVersion,
];

$regHeaders = [];
if ($enrollmentKey !== '') {
    $regHeaders[] = 'X-Enrollment-Key: ' . $enrollmentKey;
}

[$code, $body] = api_request('POST', "$serverUrl/api/agents/register", $regPayload, null, null, $regHeaders);

if ($code === 201 && isset($body['machine_id'], $body['api_key'], $body['hmac_secret'])) {
    $machineId  = $body['machine_id'];
    $apiKey     = $body['api_key'];
    $hmacSecret = $body['hmac_secret'];

    print_result('Registration', true, "Registered as $hostname (machine_id: $machineId)");
    fprintf(STDOUT, "    api_key prefix : %s...\n", substr($apiKey, 0, 16));
    fprintf(STDOUT, "    hmac_secret len: %d chars\n", strlen($hmacSecret));
} else {
    $err = $body['error'] ?? $body['message'] ?? json_encode($body);
    print_result('Registration', false, "HTTP $code - $err");
    fprintf(STDERR, "Registration failed. Cannot proceed without credentials. Aborting.\n");
    exit(1);
}

// ---------------------------------------------------------------------------
// 2. First Heartbeat
// ---------------------------------------------------------------------------

section('Step 2: Initial Heartbeat');

$hbPayload = [
    'machine_id'    => $machineId,
    'status'        => 'running',
    'agent_version' => $agentVersion,
    'queue_size'    => 0,
    'uptime_secs'   => 10,
];

[$code, $body] = api_request('POST', "$serverUrl/api/agents/heartbeat", $hbPayload, $apiKey, $hmacSecret);

if ($code === 200) {
    $forceSyncRules  = $body['force_sync_rules'] ?? false;
    $restartReq      = $body['restart_requested'] ?? false;
    $updateAvailable = $body['update_available'] ?? null;

    print_result('Heartbeat #1', true, "Accepted (HTTP 200)");
    fprintf(STDOUT, "    force_sync_rules : %s\n", $forceSyncRules ? 'true' : 'false');
    fprintf(STDOUT, "    restart_requested: %s\n", $restartReq ? 'true' : 'false');
    fprintf(STDOUT, "    update_available : %s\n", $updateAvailable ? json_encode($updateAvailable) : 'null');
} else {
    $err = $body['error'] ?? $body['message'] ?? json_encode($body);
    print_result('Heartbeat #1', false, "HTTP $code - $err");
}

// ---------------------------------------------------------------------------
// 3. Rule Sync
// ---------------------------------------------------------------------------

section('Step 3: Rule Sync');

[$code, $body] = api_request('GET', "$serverUrl/api/rules/sync?version=0", null, $apiKey, $hmacSecret);

if ($code === 200 && isset($body['rules'])) {
    $rulesCount   = count($body['rules']);
    $deletedCount = count($body['deleted_ids'] ?? []);

    print_result('Rule Sync', true, "Received $rulesCount rule(s), $deletedCount deleted ID(s)");

    if ($rulesCount > 0) {
        foreach (array_slice($body['rules'], 0, 3) as $i => $rule) {
            fprintf(STDOUT, "    Rule %d: %s (category: %s, target: %s)\n",
                $i + 1,
                $rule['name'] ?? $rule['id'] ?? '?',
                $rule['category'] ?? '?',
                $rule['target'] ?? '?'
            );
        }
        if ($rulesCount > 3) {
            fprintf(STDOUT, "    ... and %d more\n", $rulesCount - 3);
        }
    }
} else {
    $err = $body['error'] ?? $body['message'] ?? json_encode($body);
    print_result('Rule Sync', false, "HTTP $code - $err");
}

// ---------------------------------------------------------------------------
// 4. Domain Sync
// ---------------------------------------------------------------------------

section('Step 4: Domain Sync');

[$code, $body] = api_request('GET', "$serverUrl/api/domains/sync", null, $apiKey, $hmacSecret);

if ($code === 200 && isset($body['domains'])) {
    $domainCount = count($body['domains']);
    print_result('Domain Sync', true, "Received $domainCount domain(s)");

    foreach (array_slice($body['domains'], 0, 5) as $d) {
        $blockedTag = $d['is_blocked'] ? ' [BLOCKED]' : '';
        fprintf(STDOUT, "    - %s (%s)%s\n", $d['domain'], $d['platform_name'] ?? '-', $blockedTag);
    }
    if ($domainCount > 5) {
        fprintf(STDOUT, "    ... and %d more\n", $domainCount - 5);
    }
} else {
    $err = $body['error'] ?? $body['message'] ?? json_encode($body);
    print_result('Domain Sync', false, "HTTP $code - $err");
}

// ---------------------------------------------------------------------------
// 5. Event Ingestion
// ---------------------------------------------------------------------------

section('Step 5: Event Ingestion (batch of 5 events)');

$now = date('c');

$events = [
    [
        'event_type'      => 'prompt',
        'platform'        => 'chatgpt',
        'domain'          => 'chat.openai.com',
        'content_hash'    => hash('sha256', 'e2e-test-prompt-content'),
        'prompt_excerpt'  => 'Explain how to optimize a PostgreSQL query with partitioned tables.',
        'response_excerpt' => null,
        'severity'        => 'info',
        'metadata'        => json_encode(['browser' => 'chrome', 'tab_id' => 42]),
        'occurred_at'     => $now,
    ],
    [
        'event_type'       => 'response',
        'platform'         => 'claude',
        'domain'           => 'claude.ai',
        'content_hash'     => hash('sha256', 'e2e-test-response-content'),
        'prompt_excerpt'   => null,
        'response_excerpt' => 'To optimize a PostgreSQL query with partitions, ensure the query planner can prune...',
        'severity'         => 'info',
        'metadata'         => json_encode(['model' => 'claude-3', 'tokens' => 512]),
        'occurred_at'      => $now,
    ],
    [
        'event_type'      => 'clipboard',
        'platform'        => null,
        'domain'          => null,
        'content_hash'    => hash('sha256', 'e2e-test-clipboard-content'),
        'prompt_excerpt'  => 'SSN: 123-45-6789 Credit Card: 4111-1111-1111-1111',
        'response_excerpt' => null,
        'severity'        => 'warning',
        'metadata'        => json_encode(['dlp_pattern' => 'ssn,credit_card', 'source_app' => 'notepad']),
        'occurred_at'     => $now,
    ],
    [
        'event_type'      => 'block',
        'platform'        => 'chatgpt',
        'domain'          => 'chat.openai.com',
        'content_hash'    => hash('sha256', 'e2e-test-blocked-content'),
        'prompt_excerpt'  => 'Attempting to paste internal API credentials into ChatGPT',
        'response_excerpt' => null,
        'severity'        => 'critical',
        'metadata'        => json_encode(['rule_name' => 'Block credentials', 'action' => 'blocked']),
        'occurred_at'     => $now,
    ],
    [
        'event_type'      => 'alert',
        'platform'        => 'chatgpt',
        'domain'          => 'chat.openai.com',
        'content_hash'    => hash('sha256', 'e2e-test-alert-content'),
        'prompt_excerpt'  => 'Production database connection string: postgresql://admin:s3cret@prod-db...',
        'response_excerpt' => null,
        'severity'        => 'critical',
        'metadata'        => json_encode(['dlp_pattern' => 'db_connection_string', 'escalated' => true]),
        'occurred_at'     => $now,
    ],
];

$eventPayload = [
    'machine_id' => $machineId,
    'events'     => $events,
];

[$code, $body] = api_request('POST', "$serverUrl/api/events", $eventPayload, $apiKey, $hmacSecret);

if ($code === 202 && isset($body['accepted'])) {
    print_result('Event Ingestion', true, "Server accepted {$body['accepted']} event(s) (HTTP 202)");

    $types = array_column($events, 'event_type');
    fprintf(STDOUT, "    Event types sent: %s\n", implode(', ', $types));
} else {
    $err = $body['error'] ?? $body['message'] ?? json_encode($body);
    print_result('Event Ingestion', false, "HTTP $code - $err");
}

// ---------------------------------------------------------------------------
// 6. Multiple Heartbeats (simulate sustained operation)
// ---------------------------------------------------------------------------

section('Step 6: Sustained Heartbeats (3 iterations)');

$baseUptime = 60;
$allHbPassed = true;

for ($i = 1; $i <= 3; $i++) {
    $uptime = $baseUptime + ($i * 60);

    $hbPayload = [
        'machine_id'    => $machineId,
        'status'        => 'running',
        'agent_version' => $agentVersion,
        'queue_size'    => max(0, 5 - $i), // queue draining
        'uptime_secs'   => $uptime,
    ];

    [$code, $body] = api_request('POST', "$serverUrl/api/agents/heartbeat", $hbPayload, $apiKey, $hmacSecret);

    if ($code === 200) {
        fprintf(STDOUT, "    Heartbeat #%d: OK (uptime=%ds, queue=%d)\n", $i + 1, $uptime, $hbPayload['queue_size']);
    } else {
        $err = $body['error'] ?? $body['message'] ?? json_encode($body);
        fprintf(STDOUT, "    Heartbeat #%d: FAILED (HTTP %d - %s)\n", $i + 1, $code, $err);
        $allHbPassed = false;
    }

    // Small delay between heartbeats to be realistic
    usleep(200_000); // 200ms
}

print_result('Sustained Heartbeats', $allHbPassed, $allHbPassed
    ? 'All 3 follow-up heartbeats accepted'
    : 'One or more heartbeats failed');

// ---------------------------------------------------------------------------
// 7. Summary
// ---------------------------------------------------------------------------

section('Summary');

$totalSteps  = count($results);
$passedSteps = count(array_filter($results, fn ($r) => $r['success']));
$failedSteps = $totalSteps - $passedSteps;

fprintf(STDOUT, "\n");
foreach ($results as $r) {
    $tag = $r['success'] ? "\033[32m[PASS]\033[0m" : "\033[31m[FAIL]\033[0m";
    fprintf(STDOUT, "  %s  %-25s %s\n", $tag, $r['step'], $r['message']);
}

fprintf(STDOUT, "\n  Total: %d | Passed: %d | Failed: %d\n", $totalSteps, $passedSteps, $failedSteps);
fprintf(STDOUT, "  Machine hostname: %s\n", $hostname);
fprintf(STDOUT, "  Machine ID:       %s\n", $machineId ?? 'N/A');
fprintf(STDOUT, "  Server:           %s\n\n", $serverUrl);

if ($failedSteps > 0) {
    fprintf(STDOUT, "\033[31m  RESULT: FAILED\033[0m\n\n");
    exit(1);
}

fprintf(STDOUT, "\033[32m  RESULT: ALL PASSED\033[0m\n\n");
exit(0);
