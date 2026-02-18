# Icon Agent E2E Simulation

Standalone PHP script that simulates a complete Icon agent lifecycle against a running server. No Composer dependencies required -- only PHP with the `curl` extension.

## Prerequisites

1. **PHP 8.1+** with the `curl` and `json` extensions enabled.
2. **Icon backend server running** (e.g. `php artisan serve`).
3. **Database migrated and seeded** (`php artisan migrate --seed`).
4. If the server requires an enrollment key (`ICON_REGISTRATION_KEY` in `.env`), you must pass it as the second argument.

## Usage

```bash
# Default server (http://localhost:8000), no enrollment key
php tests/E2E/simulate_agent.php

# Custom server URL
php tests/E2E/simulate_agent.php http://192.168.1.50:8000

# With enrollment key
php tests/E2E/simulate_agent.php http://localhost:8000 my-secret-enrollment-key
```

You can also run it directly since the file is executable:

```bash
./tests/E2E/simulate_agent.php http://localhost:8000
```

## What it does

The script walks through the full agent lifecycle in seven steps:

| Step | Endpoint | Method | Description |
|------|----------|--------|-------------|
| 0 | `/api/health` | GET | Verifies server connectivity |
| 1 | `/api/agents/register` | POST | Registers a new machine and receives `machine_id`, `api_key`, `hmac_secret` |
| 2 | `/api/agents/heartbeat` | POST | Sends an initial heartbeat with HMAC signature; checks server commands |
| 3 | `/api/rules/sync?version=0` | GET | Fetches all active monitoring/blocking rules |
| 4 | `/api/domains/sync` | GET | Fetches all monitored AI domains |
| 5 | `/api/events` | POST | Submits a batch of 5 simulated events (prompt, response, clipboard, block, alert) |
| 6 | `/api/agents/heartbeat` | POST (x3) | Sends 3 additional heartbeats with incrementing uptime to simulate sustained operation |

Each step prints a `[PASS]` or `[FAIL]` result. At the end a summary table is displayed.

## Expected output

```
------------------------------------------------------------
  Step 0: Health Check
------------------------------------------------------------
[PASS] Health Check: Server is reachable at http://localhost:8000 (status: ok)

------------------------------------------------------------
  Step 1: Agent Registration
------------------------------------------------------------
[PASS] Registration: Registered as E2E-TEST-A3F1B2 (machine_id: xxxxxxxx-xxxx-...)
    api_key prefix : xxxxxxxxxxxxxxxx...
    hmac_secret len: 64 chars

------------------------------------------------------------
  Step 2: Initial Heartbeat
------------------------------------------------------------
[PASS] Heartbeat #1: Accepted (HTTP 200)
    force_sync_rules : false
    restart_requested: false
    update_available : null

...

------------------------------------------------------------
  Summary
------------------------------------------------------------

  [PASS]  Health Check              Server is reachable at http://localhost:8000 (status: ok)
  [PASS]  Registration              Registered as E2E-TEST-A3F1B2 (machine_id: ...)
  [PASS]  Heartbeat #1              Accepted (HTTP 200)
  [PASS]  Rule Sync                 Received 3 rule(s), 0 deleted ID(s)
  [PASS]  Domain Sync               Received 5 domain(s)
  [PASS]  Event Ingestion           Server accepted 5 event(s) (HTTP 202)
  [PASS]  Sustained Heartbeats      All 3 follow-up heartbeats accepted

  Total: 7 | Passed: 7 | Failed: 0
  Machine hostname: E2E-TEST-A3F1B2
  Machine ID:       xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  Server:           http://localhost:8000

  RESULT: ALL PASSED
```

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | All steps passed |
| 1 | One or more steps failed (or server unreachable) |

## Troubleshooting

### "Server unreachable" at step 0
- Make sure the backend is running: `php artisan serve`
- Check the URL and port match your server configuration.
- Verify no firewall is blocking the connection.

### "Invalid enrollment key" (403) at step 1
- The server has `ICON_REGISTRATION_KEY` set in `.env`.
- Pass the key as the second argument: `php simulate_agent.php http://localhost:8000 YOUR_KEY`

### "Missing API key" or "Invalid API key" (401) at steps 2-6
- This usually means registration did not succeed -- check step 1 output.
- If rerunning, the previous machine may have been disabled. A fresh run creates a new machine each time.

### "Invalid HMAC signature" (401) on POST requests
- The script computes `HMAC-SHA256(body, hmac_secret)` automatically.
- If you see this error, make sure `ICON_VERIFY_SIGNATURES` is not set to a value that changes the expected behavior.
- Check that the server `APP_KEY` has not been regenerated since registration (the `hmac_secret_encrypted` column uses Laravel's encrypter).

### Validation errors (422)
- The server rejected the payload. The error message body will contain details on which fields failed validation.
- Check that the server schema has not changed since this script was written.

### Rate limiting (429)
- The throttle middleware may kick in if you run the script many times in quick succession.
- Wait a minute and retry, or temporarily increase the rate limits in `RouteServiceProvider` / `ThrottleRequests` config.

### Events accepted but not visible in the dashboard
- Event ingestion returns `202 Accepted` and dispatches a queue job (`ProcessEventBatch`).
- Make sure the queue worker is running: `php artisan queue:work`
- Or use the sync driver for testing: set `QUEUE_CONNECTION=sync` in `.env`.
