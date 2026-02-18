//! Integration tests for the Icon Agent API client.
//!
//! These tests use `wiremock` to spin up a local HTTP mock server and verify
//! that `ApiClient` sends the correct requests, parses responses properly, and
//! handles error scenarios gracefully.

use std::path::PathBuf;

use hmac::{Hmac, Mac};
use sha2::Sha256;
use wiremock::matchers::{body_partial_json, header, header_exists, method, path, query_param};
use wiremock::{Mock, MockServer, ResponseTemplate};

use icon_agent::config::AppConfig;
use icon_agent::sync::api_client::{
    ApiClient, DomainSyncResponse, EventBatch, EventPayload, HeartbeatRequest, RuleSyncResponse,
};

type HmacSha256 = Hmac<Sha256>;

// ---------------------------------------------------------------------------
// Helper: build a test-oriented AppConfig pointing at the mock server
// ---------------------------------------------------------------------------

fn test_config(server_url: &str) -> AppConfig {
    AppConfig {
        server_url: server_url.to_string(),
        api_key: None,
        machine_id: None,
        data_dir: PathBuf::from("/tmp/icon-test"),
        db_encryption_key: "test-key".to_string(),
        proxy_port: 0,
        heartbeat_interval_secs: 60,
        event_sync_interval_secs: 30,
        event_batch_size: 100,
        local_retention_days: 7,
        server_cert_pin: None,
        hmac_secret: None,
        websocket_url: "ws://localhost:0".to_string(),
        reverb_app_key: None,
        reverb_channel: None,
        enrollment_key: None,
    }
}

/// Build a config that already has API key and HMAC secret set (simulates a
/// registered agent).
fn authenticated_config(server_url: &str) -> AppConfig {
    AppConfig {
        api_key: Some("test-api-key-123".to_string()),
        hmac_secret: Some("test-hmac-secret-456".to_string()),
        ..test_config(server_url)
    }
}

/// Compute an HMAC-SHA256 signature for a given payload using the provided
/// secret. This mirrors the logic inside `ApiClient::sign_payload`, which
/// signs `{timestamp}.{payload}` to bind the signature to the timestamp.
fn compute_hmac(secret: &str, timestamp: &str, payload: &str) -> String {
    let mut mac =
        HmacSha256::new_from_slice(secret.as_bytes()).expect("HMAC can take key of any size");
    let signed_data = format!("{}.{}", timestamp, payload);
    mac.update(signed_data.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

// ===========================================================================
// 1. Registration flow
// ===========================================================================

#[tokio::test]
async fn test_registration_success() {
    // Arrange
    let mock_server = MockServer::start().await;

    let response_body = serde_json::json!({
        "machine_id": "machine-abc-123",
        "api_key": "generated-api-key",
        "hmac_secret": "generated-hmac-secret"
    });

    Mock::given(method("POST"))
        .and(path("/api/agents/register"))
        .and(header("Content-Type", "application/json"))
        .and(body_partial_json(serde_json::json!({
            "os": std::env::consts::OS,
        })))
        .respond_with(ResponseTemplate::new(200).set_body_json(&response_body))
        .expect(1)
        .mount(&mock_server)
        .await;

    let config = test_config(&mock_server.uri());
    let client = ApiClient::new(&config).expect("ApiClient::new should succeed");

    // Act
    let resp = client.register().await.expect("register() should succeed");

    // Assert
    assert_eq!(resp.machine_id, "machine-abc-123");
    assert_eq!(resp.api_key, "generated-api-key");
    assert_eq!(resp.hmac_secret, "generated-hmac-secret");
}

#[tokio::test]
async fn test_registration_sends_required_fields() {
    let mock_server = MockServer::start().await;

    // Use a closure matcher to inspect the full request body
    Mock::given(method("POST"))
        .and(path("/api/agents/register"))
        .and(|req: &wiremock::Request| {
            let body: serde_json::Value =
                serde_json::from_slice(&req.body).expect("body should be valid JSON");
            // All four required fields must be present and non-empty
            body.get("hostname").and_then(|v| v.as_str()).is_some_and(|s| !s.is_empty())
                && body.get("os").and_then(|v| v.as_str()).is_some_and(|s| !s.is_empty())
                && body.get("os_version").and_then(|v| v.as_str()).is_some()
                && body
                    .get("agent_version")
                    .and_then(|v| v.as_str())
                    .is_some_and(|s| !s.is_empty())
        })
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "machine_id": "m-1",
            "api_key": "k-1",
            "hmac_secret": "s-1"
        })))
        .expect(1)
        .mount(&mock_server)
        .await;

    let config = test_config(&mock_server.uri());
    let client = ApiClient::new(&config).unwrap();

    let resp = client.register().await.unwrap();
    assert_eq!(resp.machine_id, "m-1");
}

#[tokio::test]
async fn test_registration_server_error() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/api/agents/register"))
        .respond_with(ResponseTemplate::new(500).set_body_string("Internal Server Error"))
        .expect(1)
        .mount(&mock_server)
        .await;

    let config = test_config(&mock_server.uri());
    let client = ApiClient::new(&config).unwrap();

    let result = client.register().await;
    assert!(result.is_err(), "register() should fail on 500");
}

// ===========================================================================
// 2. Heartbeat
// ===========================================================================

#[tokio::test]
async fn test_heartbeat_success() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/api/agents/heartbeat"))
        .and(header("X-Api-Key", "test-api-key-123"))
        .and(header_exists("X-Timestamp"))
        .and(header_exists("X-Signature"))
        .and(body_partial_json(serde_json::json!({
            "machine_id": "machine-001",
            "status": "active",
        })))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "force_sync_rules": false,
            "update_available": null
        })))
        .expect(1)
        .mount(&mock_server)
        .await;

    let config = authenticated_config(&mock_server.uri());
    let client = ApiClient::new(&config).unwrap();

    let heartbeat = HeartbeatRequest {
        machine_id: "machine-001".to_string(),
        status: "active".to_string(),
        agent_version: env!("CARGO_PKG_VERSION").to_string(),
        queue_size: 5,
        uptime_secs: 3600,
    };

    let resp = client.send_heartbeat(&heartbeat).await.unwrap();
    assert!(!resp.force_sync_rules);
    assert!(resp.update_available.is_none());
}

#[tokio::test]
async fn test_heartbeat_with_force_sync() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/api/agents/heartbeat"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "force_sync_rules": true,
            "update_available": null
        })))
        .mount(&mock_server)
        .await;

    let config = authenticated_config(&mock_server.uri());
    let client = ApiClient::new(&config).unwrap();

    let heartbeat = HeartbeatRequest {
        machine_id: "machine-002".to_string(),
        status: "active".to_string(),
        agent_version: env!("CARGO_PKG_VERSION").to_string(),
        queue_size: 0,
        uptime_secs: 120,
    };

    let resp = client.send_heartbeat(&heartbeat).await.unwrap();
    assert!(resp.force_sync_rules);
}

#[tokio::test]
async fn test_heartbeat_with_update_available() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/api/agents/heartbeat"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "force_sync_rules": false,
            "update_available": {
                "version": "1.2.0",
                "download_url": "https://releases.example.com/agent-1.2.0",
                "checksum": "sha256:abcdef1234567890"
            }
        })))
        .mount(&mock_server)
        .await;

    let config = authenticated_config(&mock_server.uri());
    let client = ApiClient::new(&config).unwrap();

    let heartbeat = HeartbeatRequest {
        machine_id: "machine-003".to_string(),
        status: "active".to_string(),
        agent_version: env!("CARGO_PKG_VERSION").to_string(),
        queue_size: 10,
        uptime_secs: 7200,
    };

    let resp = client.send_heartbeat(&heartbeat).await.unwrap();
    assert!(!resp.force_sync_rules);

    let update = resp.update_available.expect("update_available should be Some");
    assert_eq!(update.version, "1.2.0");
    assert_eq!(update.download_url, "https://releases.example.com/agent-1.2.0");
    assert_eq!(update.checksum, "sha256:abcdef1234567890");
}

#[tokio::test]
async fn test_heartbeat_verifies_all_fields_sent() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/api/agents/heartbeat"))
        .and(|req: &wiremock::Request| {
            let body: serde_json::Value =
                serde_json::from_slice(&req.body).expect("body should be valid JSON");
            body.get("machine_id").and_then(|v| v.as_str()) == Some("hb-machine")
                && body.get("status").and_then(|v| v.as_str()) == Some("active")
                && body.get("agent_version").and_then(|v| v.as_str()).is_some()
                && body.get("queue_size").and_then(|v| v.as_u64()) == Some(42)
                && body.get("uptime_secs").and_then(|v| v.as_u64()) == Some(999)
        })
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "force_sync_rules": false,
            "update_available": null
        })))
        .expect(1)
        .mount(&mock_server)
        .await;

    let config = authenticated_config(&mock_server.uri());
    let client = ApiClient::new(&config).unwrap();

    let heartbeat = HeartbeatRequest {
        machine_id: "hb-machine".to_string(),
        status: "active".to_string(),
        agent_version: env!("CARGO_PKG_VERSION").to_string(),
        queue_size: 42,
        uptime_secs: 999,
    };

    client.send_heartbeat(&heartbeat).await.unwrap();
}

// ===========================================================================
// 3. Event ingestion
// ===========================================================================

#[tokio::test]
async fn test_send_events_success() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/api/events"))
        .and(header("X-Api-Key", "test-api-key-123"))
        .and(header_exists("X-Timestamp"))
        .and(header_exists("X-Signature"))
        .respond_with(ResponseTemplate::new(200))
        .expect(1)
        .mount(&mock_server)
        .await;

    let config = authenticated_config(&mock_server.uri());
    let client = ApiClient::new(&config).unwrap();

    let batch = EventBatch {
        machine_id: "machine-events-001".to_string(),
        events: vec![
            EventPayload {
                event_type: "prompt_blocked".to_string(),
                platform: Some("chatgpt".to_string()),
                domain: Some("chat.openai.com".to_string()),
                content_hash: Some("abc123hash".to_string()),
                prompt_excerpt: Some("Tell me how to...".to_string()),
                response_excerpt: None,
                rule_id: Some("rule-1".to_string()),
                severity: Some("critical".to_string()),
                metadata: None,
                occurred_at: "2026-02-18T10:00:00Z".to_string(),
            },
            EventPayload {
                event_type: "response_logged".to_string(),
                platform: Some("claude".to_string()),
                domain: Some("claude.ai".to_string()),
                content_hash: Some("def456hash".to_string()),
                prompt_excerpt: None,
                response_excerpt: Some("Here is the response...".to_string()),
                rule_id: None,
                severity: Some("info".to_string()),
                metadata: Some("{\"key\":\"value\"}".to_string()),
                occurred_at: "2026-02-18T10:01:00Z".to_string(),
            },
            EventPayload {
                event_type: "clipboard_alert".to_string(),
                platform: None,
                domain: None,
                content_hash: Some("ghi789hash".to_string()),
                prompt_excerpt: None,
                response_excerpt: None,
                rule_id: Some("rule-3".to_string()),
                severity: Some("warning".to_string()),
                metadata: None,
                occurred_at: "2026-02-18T10:02:00Z".to_string(),
            },
        ],
    };

    let result = client.send_events(&batch).await;
    assert!(result.is_ok(), "send_events() should succeed");
}

#[tokio::test]
async fn test_send_events_hmac_signature_header() {
    let mock_server = MockServer::start().await;
    let hmac_secret = "test-hmac-secret-456";

    // Capture the request and verify the HMAC signature manually.
    // The signature now covers "{timestamp}.{body}" instead of just "{body}".
    Mock::given(method("POST"))
        .and(path("/api/events"))
        .and(move |req: &wiremock::Request| {
            // Extract the signature header
            let signature = req
                .headers
                .get("X-Signature")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("");

            // Extract the timestamp header
            let timestamp = req
                .headers
                .get("X-Timestamp")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("");

            // The body that was signed
            let body_str = std::str::from_utf8(&req.body).unwrap_or("");

            // Recompute expected HMAC using {timestamp}.{body}
            let expected = compute_hmac(hmac_secret, timestamp, body_str);

            signature == expected
        })
        .respond_with(ResponseTemplate::new(200))
        .expect(1)
        .mount(&mock_server)
        .await;

    let config = authenticated_config(&mock_server.uri());
    let client = ApiClient::new(&config).unwrap();

    let batch = EventBatch {
        machine_id: "sig-test-machine".to_string(),
        events: vec![EventPayload {
            event_type: "test_event".to_string(),
            platform: Some("test".to_string()),
            domain: None,
            content_hash: None,
            prompt_excerpt: Some("test prompt".to_string()),
            response_excerpt: None,
            rule_id: None,
            severity: None,
            metadata: None,
            occurred_at: "2026-02-18T12:00:00Z".to_string(),
        }],
    };

    client
        .send_events(&batch)
        .await
        .expect("send_events() should succeed with correct HMAC");
}

#[tokio::test]
async fn test_send_events_has_api_key_header() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/api/events"))
        .and(header("X-Api-Key", "test-api-key-123"))
        .respond_with(ResponseTemplate::new(200))
        .expect(1)
        .mount(&mock_server)
        .await;

    let config = authenticated_config(&mock_server.uri());
    let client = ApiClient::new(&config).unwrap();

    let batch = EventBatch {
        machine_id: "key-test".to_string(),
        events: vec![EventPayload {
            event_type: "test".to_string(),
            platform: None,
            domain: None,
            content_hash: None,
            prompt_excerpt: None,
            response_excerpt: None,
            rule_id: None,
            severity: None,
            metadata: None,
            occurred_at: "2026-02-18T00:00:00Z".to_string(),
        }],
    };

    client.send_events(&batch).await.unwrap();
}

#[tokio::test]
async fn test_send_events_has_timestamp_header() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/api/events"))
        .and(header_exists("X-Timestamp"))
        .and(|req: &wiremock::Request| {
            // The timestamp should be a valid Unix epoch timestamp
            let ts = req
                .headers
                .get("X-Timestamp")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("0");
            let parsed: i64 = ts.parse().unwrap_or(0);
            // Timestamp should be reasonably recent (within the last hour)
            let now = chrono::Utc::now().timestamp();
            (now - parsed).abs() < 3600
        })
        .respond_with(ResponseTemplate::new(200))
        .expect(1)
        .mount(&mock_server)
        .await;

    let config = authenticated_config(&mock_server.uri());
    let client = ApiClient::new(&config).unwrap();

    let batch = EventBatch {
        machine_id: "ts-test".to_string(),
        events: vec![EventPayload {
            event_type: "test".to_string(),
            platform: None,
            domain: None,
            content_hash: None,
            prompt_excerpt: None,
            response_excerpt: None,
            rule_id: None,
            severity: None,
            metadata: None,
            occurred_at: "2026-02-18T00:00:00Z".to_string(),
        }],
    };

    client.send_events(&batch).await.unwrap();
}

#[tokio::test]
async fn test_send_events_batch_body_contains_all_events() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/api/events"))
        .and(|req: &wiremock::Request| {
            let body: serde_json::Value =
                serde_json::from_slice(&req.body).expect("body should be valid JSON");
            let events = body.get("events").and_then(|v| v.as_array());
            events.is_some_and(|arr| arr.len() == 3)
        })
        .respond_with(ResponseTemplate::new(200))
        .expect(1)
        .mount(&mock_server)
        .await;

    let config = authenticated_config(&mock_server.uri());
    let client = ApiClient::new(&config).unwrap();

    let batch = EventBatch {
        machine_id: "batch-test".to_string(),
        events: vec![
            EventPayload {
                event_type: "event_1".to_string(),
                platform: None,
                domain: None,
                content_hash: None,
                prompt_excerpt: None,
                response_excerpt: None,
                rule_id: None,
                severity: None,
                metadata: None,
                occurred_at: "2026-02-18T01:00:00Z".to_string(),
            },
            EventPayload {
                event_type: "event_2".to_string(),
                platform: None,
                domain: None,
                content_hash: None,
                prompt_excerpt: None,
                response_excerpt: None,
                rule_id: None,
                severity: None,
                metadata: None,
                occurred_at: "2026-02-18T02:00:00Z".to_string(),
            },
            EventPayload {
                event_type: "event_3".to_string(),
                platform: None,
                domain: None,
                content_hash: None,
                prompt_excerpt: None,
                response_excerpt: None,
                rule_id: None,
                severity: None,
                metadata: None,
                occurred_at: "2026-02-18T03:00:00Z".to_string(),
            },
        ],
    };

    client.send_events(&batch).await.unwrap();
}

#[tokio::test]
async fn test_send_events_server_rejects_returns_error() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/api/events"))
        .respond_with(ResponseTemplate::new(422).set_body_json(serde_json::json!({
            "error": "Validation failed"
        })))
        .mount(&mock_server)
        .await;

    let config = authenticated_config(&mock_server.uri());
    let client = ApiClient::new(&config).unwrap();

    let batch = EventBatch {
        machine_id: "reject-test".to_string(),
        events: vec![EventPayload {
            event_type: "bad_event".to_string(),
            platform: None,
            domain: None,
            content_hash: None,
            prompt_excerpt: None,
            response_excerpt: None,
            rule_id: None,
            severity: None,
            metadata: None,
            occurred_at: "2026-02-18T00:00:00Z".to_string(),
        }],
    };

    let result = client.send_events(&batch).await;
    assert!(result.is_err(), "send_events() should fail on 422");
}

// ===========================================================================
// 4. Rule sync
// ===========================================================================

#[tokio::test]
async fn test_sync_rules_success() {
    let mock_server = MockServer::start().await;

    let rules_json = serde_json::json!({
        "rules": [
            {
                "id": "rule-block-1",
                "name": "Block sensitive prompts",
                "version": 3,
                "category": "block",
                "target": "prompt",
                "condition": {
                    "type": "regex",
                    "pattern": "password|secret|credential",
                    "case_insensitive": true
                },
                "action": {
                    "type": "block",
                    "message": "Sensitive content detected in prompt."
                },
                "priority": 100,
                "enabled": true
            },
            {
                "id": "rule-alert-2",
                "name": "Alert on code snippets",
                "version": 5,
                "category": "alert",
                "target": "response",
                "condition": {
                    "type": "keyword",
                    "keywords": ["SELECT", "DROP TABLE", "DELETE FROM"],
                    "match_all": false
                },
                "action": {
                    "type": "alert",
                    "severity": "warning"
                },
                "priority": 50,
                "enabled": true
            },
            {
                "id": "rule-log-3",
                "name": "Log all clipboard activity",
                "version": 1,
                "category": "log",
                "target": "clipboard",
                "condition": {
                    "type": "content_length",
                    "min": 10,
                    "max": null
                },
                "action": {
                    "type": "log"
                },
                "priority": 10,
                "enabled": false
            }
        ],
        "deleted_ids": ["old-rule-a", "old-rule-b"]
    });

    Mock::given(method("GET"))
        .and(path("/api/rules/sync"))
        .and(query_param("version", "0"))
        .and(header("X-Api-Key", "test-api-key-123"))
        .and(header_exists("X-Timestamp"))
        .respond_with(ResponseTemplate::new(200).set_body_json(&rules_json))
        .expect(1)
        .mount(&mock_server)
        .await;

    let config = authenticated_config(&mock_server.uri());
    let client = ApiClient::new(&config).unwrap();

    let resp: RuleSyncResponse = client.sync_rules(0).await.unwrap();

    // Verify rules count
    assert_eq!(resp.rules.len(), 3);

    // Verify block rule
    let block_rule = &resp.rules[0];
    assert_eq!(block_rule.id, "rule-block-1");
    assert_eq!(block_rule.name, "Block sensitive prompts");
    assert_eq!(block_rule.version, 3);
    assert_eq!(
        block_rule.category,
        icon_agent::rules::models::RuleCategory::Block
    );
    assert_eq!(
        block_rule.target,
        icon_agent::rules::models::RuleTarget::Prompt
    );
    assert_eq!(block_rule.priority, 100);
    assert!(block_rule.enabled);

    // Verify alert rule
    let alert_rule = &resp.rules[1];
    assert_eq!(alert_rule.id, "rule-alert-2");
    assert_eq!(
        alert_rule.category,
        icon_agent::rules::models::RuleCategory::Alert
    );
    assert_eq!(
        alert_rule.target,
        icon_agent::rules::models::RuleTarget::Response
    );
    assert_eq!(alert_rule.version, 5);

    // Verify log rule
    let log_rule = &resp.rules[2];
    assert_eq!(log_rule.id, "rule-log-3");
    assert_eq!(
        log_rule.category,
        icon_agent::rules::models::RuleCategory::Log
    );
    assert_eq!(
        log_rule.target,
        icon_agent::rules::models::RuleTarget::Clipboard
    );
    assert!(!log_rule.enabled);

    // Verify deleted_ids
    assert_eq!(resp.deleted_ids.len(), 2);
    assert!(resp.deleted_ids.contains(&"old-rule-a".to_string()));
    assert!(resp.deleted_ids.contains(&"old-rule-b".to_string()));
}

#[tokio::test]
async fn test_sync_rules_with_version_parameter() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/api/rules/sync"))
        .and(query_param("version", "42"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "rules": [],
            "deleted_ids": []
        })))
        .expect(1)
        .mount(&mock_server)
        .await;

    let config = authenticated_config(&mock_server.uri());
    let client = ApiClient::new(&config).unwrap();

    let resp = client.sync_rules(42).await.unwrap();
    assert!(resp.rules.is_empty());
    assert!(resp.deleted_ids.is_empty());
}

#[tokio::test]
async fn test_sync_rules_with_domain_list_condition() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/api/rules/sync"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "rules": [{
                "id": "rule-domain-1",
                "name": "Block unauthorized AI platforms",
                "version": 2,
                "category": "block",
                "target": "domain",
                "condition": {
                    "type": "domain_list",
                    "domains": ["unauthorized-ai.com", "shady-llm.io"]
                },
                "action": {
                    "type": "block",
                    "message": "This AI platform is not authorized."
                },
                "priority": 200,
                "enabled": true
            }],
            "deleted_ids": []
        })))
        .mount(&mock_server)
        .await;

    let config = authenticated_config(&mock_server.uri());
    let client = ApiClient::new(&config).unwrap();

    let resp = client.sync_rules(0).await.unwrap();
    assert_eq!(resp.rules.len(), 1);

    let rule = &resp.rules[0];
    assert_eq!(rule.id, "rule-domain-1");
    assert_eq!(
        rule.target,
        icon_agent::rules::models::RuleTarget::Domain
    );

    // Verify the condition is DomainList
    match &rule.condition {
        icon_agent::rules::models::RuleCondition::DomainList { domains } => {
            assert_eq!(domains.len(), 2);
            assert!(domains.contains(&"unauthorized-ai.com".to_string()));
            assert!(domains.contains(&"shady-llm.io".to_string()));
        }
        other => panic!(
            "Expected DomainList condition, got: {:?}",
            other
        ),
    }
}

// ===========================================================================
// 5. Domain sync
// ===========================================================================

#[tokio::test]
async fn test_sync_domains_success() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/api/domains/sync"))
        .and(header("X-Api-Key", "test-api-key-123"))
        .and(header_exists("X-Timestamp"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "domains": [
                {
                    "domain": "chat.openai.com",
                    "platform_name": "ChatGPT",
                    "is_blocked": false
                },
                {
                    "domain": "claude.ai",
                    "platform_name": "Claude",
                    "is_blocked": false
                },
                {
                    "domain": "bard.google.com",
                    "platform_name": "Bard",
                    "is_blocked": true
                },
                {
                    "domain": "unauthorized-ai.example.com",
                    "platform_name": null,
                    "is_blocked": true
                }
            ]
        })))
        .expect(1)
        .mount(&mock_server)
        .await;

    let config = authenticated_config(&mock_server.uri());
    let client = ApiClient::new(&config).unwrap();

    let resp: DomainSyncResponse = client.sync_domains().await.unwrap();

    assert_eq!(resp.domains.len(), 4);

    // Verify first domain
    assert_eq!(resp.domains[0].domain, "chat.openai.com");
    assert_eq!(
        resp.domains[0].platform_name.as_deref(),
        Some("ChatGPT")
    );
    assert!(!resp.domains[0].is_blocked);

    // Verify blocked domain
    assert_eq!(resp.domains[2].domain, "bard.google.com");
    assert!(resp.domains[2].is_blocked);

    // Verify domain with null platform_name
    assert_eq!(resp.domains[3].domain, "unauthorized-ai.example.com");
    assert!(resp.domains[3].platform_name.is_none());
    assert!(resp.domains[3].is_blocked);
}

#[tokio::test]
async fn test_sync_domains_empty_list() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/api/domains/sync"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "domains": []
        })))
        .mount(&mock_server)
        .await;

    let config = authenticated_config(&mock_server.uri());
    let client = ApiClient::new(&config).unwrap();

    let resp = client.sync_domains().await.unwrap();
    assert!(resp.domains.is_empty());
}

// ===========================================================================
// 6. Server unreachable / error scenarios
// ===========================================================================

#[tokio::test]
async fn test_server_returns_500_on_heartbeat() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/api/agents/heartbeat"))
        .respond_with(ResponseTemplate::new(500))
        .mount(&mock_server)
        .await;

    let config = authenticated_config(&mock_server.uri());
    let client = ApiClient::new(&config).unwrap();

    let heartbeat = HeartbeatRequest {
        machine_id: "err-machine".to_string(),
        status: "active".to_string(),
        agent_version: env!("CARGO_PKG_VERSION").to_string(),
        queue_size: 0,
        uptime_secs: 0,
    };

    // The authenticated_post method does not call error_for_status() itself for
    // heartbeat, but send_heartbeat tries to parse the JSON body which will fail
    // on a 500 response without valid JSON.
    let result = client.send_heartbeat(&heartbeat).await;
    assert!(result.is_err(), "Heartbeat should fail on 500");
}

#[tokio::test]
async fn test_server_returns_500_on_rule_sync() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/api/rules/sync"))
        .respond_with(ResponseTemplate::new(500))
        .mount(&mock_server)
        .await;

    let config = authenticated_config(&mock_server.uri());
    let client = ApiClient::new(&config).unwrap();

    let result = client.sync_rules(0).await;
    assert!(result.is_err(), "sync_rules should fail on 500");
}

#[tokio::test]
async fn test_server_returns_500_on_domain_sync() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/api/domains/sync"))
        .respond_with(ResponseTemplate::new(500))
        .mount(&mock_server)
        .await;

    let config = authenticated_config(&mock_server.uri());
    let client = ApiClient::new(&config).unwrap();

    let result = client.sync_domains().await;
    assert!(result.is_err(), "sync_domains should fail on 500");
}

#[tokio::test]
async fn test_connection_refused() {
    // Use a port that is almost certainly not listening.
    // Port 1 is typically not open and the OS will refuse the connection.
    let config = authenticated_config("http://127.0.0.1:1");
    let client = ApiClient::new(&config).unwrap();

    let heartbeat = HeartbeatRequest {
        machine_id: "no-server".to_string(),
        status: "active".to_string(),
        agent_version: env!("CARGO_PKG_VERSION").to_string(),
        queue_size: 0,
        uptime_secs: 0,
    };

    let result = client.send_heartbeat(&heartbeat).await;
    assert!(
        result.is_err(),
        "Heartbeat should fail when server is unreachable"
    );
}

#[tokio::test]
async fn test_connection_refused_register() {
    let config = test_config("http://127.0.0.1:1");
    let client = ApiClient::new(&config).unwrap();

    let result = client.register().await;
    assert!(
        result.is_err(),
        "register() should fail when server is unreachable"
    );
}

#[tokio::test]
async fn test_connection_refused_send_events() {
    let config = authenticated_config("http://127.0.0.1:1");
    let client = ApiClient::new(&config).unwrap();

    let batch = EventBatch {
        machine_id: "no-server".to_string(),
        events: vec![EventPayload {
            event_type: "test".to_string(),
            platform: None,
            domain: None,
            content_hash: None,
            prompt_excerpt: None,
            response_excerpt: None,
            rule_id: None,
            severity: None,
            metadata: None,
            occurred_at: "2026-02-18T00:00:00Z".to_string(),
        }],
    };

    let result = client.send_events(&batch).await;
    assert!(
        result.is_err(),
        "send_events() should fail when server is unreachable"
    );
}

#[tokio::test]
async fn test_connection_refused_sync_rules() {
    let config = authenticated_config("http://127.0.0.1:1");
    let client = ApiClient::new(&config).unwrap();

    let result = client.sync_rules(0).await;
    assert!(
        result.is_err(),
        "sync_rules() should fail when server is unreachable"
    );
}

#[tokio::test]
async fn test_connection_refused_sync_domains() {
    let config = authenticated_config("http://127.0.0.1:1");
    let client = ApiClient::new(&config).unwrap();

    let result = client.sync_domains().await;
    assert!(
        result.is_err(),
        "sync_domains() should fail when server is unreachable"
    );
}

#[tokio::test]
async fn test_server_returns_401_unauthorized() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/api/rules/sync"))
        .respond_with(ResponseTemplate::new(401).set_body_json(serde_json::json!({
            "error": "Unauthorized"
        })))
        .mount(&mock_server)
        .await;

    let config = authenticated_config(&mock_server.uri());
    let client = ApiClient::new(&config).unwrap();

    let result = client.sync_rules(0).await;
    assert!(result.is_err(), "sync_rules should fail on 401");
}

#[tokio::test]
async fn test_server_returns_malformed_json() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/api/rules/sync"))
        .respond_with(
            ResponseTemplate::new(200).set_body_string("this is not valid JSON at all {{{"),
        )
        .mount(&mock_server)
        .await;

    let config = authenticated_config(&mock_server.uri());
    let client = ApiClient::new(&config).unwrap();

    let result = client.sync_rules(0).await;
    assert!(
        result.is_err(),
        "sync_rules should fail on malformed JSON response"
    );
}

// ===========================================================================
// 7. HMAC signature verification
// ===========================================================================

#[tokio::test]
async fn test_hmac_signature_is_correct() {
    let mock_server = MockServer::start().await;
    let hmac_secret = "test-hmac-secret-456";

    // Install a mock that captures and validates the HMAC signature.
    // The signature now covers "{timestamp}.{body}" to prevent replay attacks.
    Mock::given(method("POST"))
        .and(path("/api/events"))
        .and(move |req: &wiremock::Request| {
            let signature = match req.headers.get("X-Signature").and_then(|v| v.to_str().ok()) {
                Some(s) => s.to_string(),
                None => return false,
            };
            let timestamp = match req.headers.get("X-Timestamp").and_then(|v| v.to_str().ok()) {
                Some(s) => s,
                None => return false,
            };
            let body_str = match std::str::from_utf8(&req.body) {
                Ok(s) => s,
                Err(_) => return false,
            };
            let expected = compute_hmac(hmac_secret, timestamp, body_str);
            signature == expected
        })
        .respond_with(ResponseTemplate::new(200))
        .expect(1)
        .mount(&mock_server)
        .await;

    let config = authenticated_config(&mock_server.uri());
    let client = ApiClient::new(&config).unwrap();

    let batch = EventBatch {
        machine_id: "hmac-verify".to_string(),
        events: vec![EventPayload {
            event_type: "hmac_test".to_string(),
            platform: Some("test_platform".to_string()),
            domain: Some("example.com".to_string()),
            content_hash: Some("hash123".to_string()),
            prompt_excerpt: Some("This is a test prompt for HMAC verification".to_string()),
            response_excerpt: Some("This is the response".to_string()),
            rule_id: Some("rule-42".to_string()),
            severity: Some("info".to_string()),
            metadata: Some("{\"detail\":\"hmac-test\"}".to_string()),
            occurred_at: "2026-02-18T15:30:00Z".to_string(),
        }],
    };

    client
        .send_events(&batch)
        .await
        .expect("send_events should succeed with valid HMAC");
}

#[tokio::test]
async fn test_hmac_not_sent_without_secret() {
    let mock_server = MockServer::start().await;

    // Verify that when no HMAC secret is configured, no X-Signature header is sent
    Mock::given(method("POST"))
        .and(path("/api/agents/heartbeat"))
        .and(|req: &wiremock::Request| {
            // X-Signature header should NOT be present
            req.headers.get("X-Signature").is_none()
        })
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "force_sync_rules": false,
            "update_available": null
        })))
        .expect(1)
        .mount(&mock_server)
        .await;

    // Config without HMAC secret but with API key
    let mut config = test_config(&mock_server.uri());
    config.api_key = Some("key-without-hmac".to_string());
    // hmac_secret is None by default from test_config

    let client = ApiClient::new(&config).unwrap();

    let heartbeat = HeartbeatRequest {
        machine_id: "no-hmac".to_string(),
        status: "active".to_string(),
        agent_version: env!("CARGO_PKG_VERSION").to_string(),
        queue_size: 0,
        uptime_secs: 0,
    };

    client.send_heartbeat(&heartbeat).await.unwrap();
}

#[tokio::test]
async fn test_hmac_api_key_not_sent_without_credentials() {
    let mock_server = MockServer::start().await;

    // Verify that when no API key is configured, no X-Api-Key header is sent
    Mock::given(method("POST"))
        .and(path("/api/agents/heartbeat"))
        .and(|req: &wiremock::Request| {
            req.headers.get("X-Api-Key").is_none()
                && req.headers.get("X-Signature").is_none()
        })
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "force_sync_rules": false,
            "update_available": null
        })))
        .expect(1)
        .mount(&mock_server)
        .await;

    // Config with no credentials at all
    let config = test_config(&mock_server.uri());
    let client = ApiClient::new(&config).unwrap();

    let heartbeat = HeartbeatRequest {
        machine_id: "no-creds".to_string(),
        status: "active".to_string(),
        agent_version: env!("CARGO_PKG_VERSION").to_string(),
        queue_size: 0,
        uptime_secs: 0,
    };

    client.send_heartbeat(&heartbeat).await.unwrap();
}

#[tokio::test]
async fn test_hmac_signature_deterministic() {
    // Verify that computing the same HMAC twice with the same inputs gives the
    // same result, confirming deterministic behavior.
    let secret = "deterministic-test-secret";
    let timestamp = "1700000000";
    let payload = r#"{"machine_id":"test","events":[]}"#;

    let sig1 = compute_hmac(secret, timestamp, payload);
    let sig2 = compute_hmac(secret, timestamp, payload);

    assert_eq!(sig1, sig2, "HMAC should be deterministic");
    // Also verify it is a valid hex string of the right length (SHA-256 = 32 bytes = 64 hex chars)
    assert_eq!(sig1.len(), 64, "HMAC-SHA256 hex should be 64 characters");
    assert!(
        sig1.chars().all(|c| c.is_ascii_hexdigit()),
        "HMAC should be a hex-encoded string"
    );
}

#[tokio::test]
async fn test_hmac_different_payloads_produce_different_signatures() {
    let secret = "shared-secret";
    let timestamp = "1700000000";
    let payload_a = r#"{"machine_id":"a","events":[]}"#;
    let payload_b = r#"{"machine_id":"b","events":[]}"#;

    let sig_a = compute_hmac(secret, timestamp, payload_a);
    let sig_b = compute_hmac(secret, timestamp, payload_b);

    assert_ne!(sig_a, sig_b, "Different payloads should produce different HMACs");
}

#[tokio::test]
async fn test_hmac_different_secrets_produce_different_signatures() {
    let timestamp = "1700000000";
    let payload = r#"{"machine_id":"test","events":[]}"#;
    let sig_1 = compute_hmac("secret-one", timestamp, payload);
    let sig_2 = compute_hmac("secret-two", timestamp, payload);

    assert_ne!(
        sig_1, sig_2,
        "Different secrets should produce different HMACs"
    );
}

#[tokio::test]
async fn test_hmac_different_timestamps_produce_different_signatures() {
    let secret = "shared-secret";
    let payload = r#"{"machine_id":"test","events":[]}"#;
    let sig_1 = compute_hmac(secret, "1700000000", payload);
    let sig_2 = compute_hmac(secret, "1700000001", payload);

    assert_ne!(
        sig_1, sig_2,
        "Different timestamps should produce different HMACs even with same payload"
    );
}

// ===========================================================================
// Additional edge-case tests
// ===========================================================================

#[tokio::test]
async fn test_set_credentials_updates_headers() {
    let mock_server = MockServer::start().await;

    // First mock: heartbeat without credentials (no X-Api-Key)
    Mock::given(method("POST"))
        .and(path("/api/agents/heartbeat"))
        .and(header("X-Api-Key", "new-api-key"))
        .and(header_exists("X-Signature"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "force_sync_rules": false,
            "update_available": null
        })))
        .expect(1)
        .mount(&mock_server)
        .await;

    let config = test_config(&mock_server.uri());
    let mut client = ApiClient::new(&config).unwrap();

    // Set credentials after construction (simulates post-registration)
    client.set_credentials("new-api-key".to_string(), "new-hmac-secret".to_string());

    let heartbeat = HeartbeatRequest {
        machine_id: "cred-test".to_string(),
        status: "active".to_string(),
        agent_version: env!("CARGO_PKG_VERSION").to_string(),
        queue_size: 0,
        uptime_secs: 0,
    };

    client.send_heartbeat(&heartbeat).await.unwrap();
}

#[tokio::test]
async fn test_is_server_reachable_returns_true() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/api/health"))
        .respond_with(ResponseTemplate::new(200))
        .mount(&mock_server)
        .await;

    let config = test_config(&mock_server.uri());
    let client = ApiClient::new(&config).unwrap();

    assert!(client.is_server_reachable().await);
}

#[tokio::test]
async fn test_is_server_reachable_returns_false_on_500() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/api/health"))
        .respond_with(ResponseTemplate::new(500))
        .mount(&mock_server)
        .await;

    let config = test_config(&mock_server.uri());
    let client = ApiClient::new(&config).unwrap();

    assert!(!client.is_server_reachable().await);
}

#[tokio::test]
async fn test_is_server_reachable_returns_false_when_down() {
    let config = test_config("http://127.0.0.1:1");
    let client = ApiClient::new(&config).unwrap();

    assert!(!client.is_server_reachable().await);
}

#[tokio::test]
async fn test_check_update_returns_update_info() {
    let mock_server = MockServer::start().await;

    let version = env!("CARGO_PKG_VERSION");
    let path_str = "/api/agents/update".to_string();

    Mock::given(method("GET"))
        .and(path(&path_str))
        .and(query_param("version", version))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "version": "2.0.0",
            "download_url": "https://releases.example.com/icon-agent-2.0.0",
            "checksum": "sha256:deadbeef"
        })))
        .mount(&mock_server)
        .await;

    let config = authenticated_config(&mock_server.uri());
    let client = ApiClient::new(&config).unwrap();

    let result = client.check_update().await.unwrap();
    assert!(result.is_some());

    let update = result.unwrap();
    assert_eq!(update.version, "2.0.0");
    assert_eq!(
        update.download_url,
        "https://releases.example.com/icon-agent-2.0.0"
    );
    assert_eq!(update.checksum, "sha256:deadbeef");
}

#[tokio::test]
async fn test_check_update_returns_none_on_204() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/api/agents/update"))
        .respond_with(ResponseTemplate::new(204))
        .mount(&mock_server)
        .await;

    let config = authenticated_config(&mock_server.uri());
    let client = ApiClient::new(&config).unwrap();

    let result = client.check_update().await.unwrap();
    assert!(
        result.is_none(),
        "check_update should return None on 204 No Content"
    );
}

#[tokio::test]
async fn test_concurrent_requests_to_different_endpoints() {
    let mock_server = MockServer::start().await;

    // Set up mocks for multiple endpoints
    Mock::given(method("GET"))
        .and(path("/api/rules/sync"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "rules": [],
            "deleted_ids": []
        })))
        .mount(&mock_server)
        .await;

    Mock::given(method("GET"))
        .and(path("/api/domains/sync"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "domains": []
        })))
        .mount(&mock_server)
        .await;

    Mock::given(method("POST"))
        .and(path("/api/agents/heartbeat"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "force_sync_rules": false,
            "update_available": null
        })))
        .mount(&mock_server)
        .await;

    let config = authenticated_config(&mock_server.uri());
    let client = std::sync::Arc::new(ApiClient::new(&config).unwrap());

    // Fire all three requests concurrently
    let client_rules = client.clone();
    let client_domains = client.clone();
    let client_heartbeat = client.clone();

    let (rules_res, domains_res, heartbeat_res) = tokio::join!(
        async move { client_rules.sync_rules(0).await },
        async move { client_domains.sync_domains().await },
        async move {
            client_heartbeat
                .send_heartbeat(&HeartbeatRequest {
                    machine_id: "concurrent".to_string(),
                    status: "active".to_string(),
                    agent_version: env!("CARGO_PKG_VERSION").to_string(),
                    queue_size: 0,
                    uptime_secs: 0,
                })
                .await
        },
    );

    assert!(rules_res.is_ok(), "sync_rules should succeed");
    assert!(domains_res.is_ok(), "sync_domains should succeed");
    assert!(heartbeat_res.is_ok(), "send_heartbeat should succeed");
}
