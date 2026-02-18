use std::sync::Arc;
use tokio::time::{interval, Duration};
use tracing::{info, warn, debug};
use sha2::{Sha256, Digest};
use serde_json::json;

use crate::config::AppConfig;
use crate::rules::engine::RuleEngine;
use crate::rules::models::{EvaluationResult, RuleTarget};
use crate::sync::queue::EventQueue;

/// Built-in DLP patterns for common sensitive data types.
/// These are always active as a baseline, independent of server rules.
static BUILTIN_DLP_PATTERNS: &[(&str, &str, &str)] = &[
    // (name, pattern, description)
    ("credit_card", r"\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b", "Numero de carte bancaire"),
    ("french_ssn", r"\b[12][0-9]{2}(?:0[1-9]|1[0-2])[0-9]{2}[0-9]{3}[0-9]{3}[0-9]{2}\b", "Numero de securite sociale (France)"),
    ("iban_fr", r"\bFR\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{3}\b", "IBAN francais"),
    ("email_bulk", r"(?i)(?:[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}\s*[,;\n]\s*){3,}", "Liste d adresses email (3+)"),
    ("phone_fr", r"\b(?:(?:\+33|0033|0)\s?[1-9])(?:[\s.\-]?\d{2}){4}\b", "Numero de telephone francais"),
    ("api_key_generic", r#"(?i)(?:api[_\-]?key|token|secret|password)\s*[:=]\s*['"]?[a-z0-9_\-]{20,}['"]?"#, "Cle API / token / mot de passe"),
    ("private_key", r"-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----", "Cle privee cryptographique"),
    ("aws_key", r"(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}", "Cle d acces AWS"),
];

/// Configuration for the clipboard monitor
pub struct ClipboardMonitorConfig {
    /// Polling interval in milliseconds
    pub poll_interval_ms: u64,
    /// Maximum content length to scan (truncate if longer)
    pub max_scan_length: usize,
    /// Maximum excerpt length stored in events
    pub max_excerpt_length: usize,
    /// Whether built-in DLP patterns are enabled
    pub builtin_dlp_enabled: bool,
    /// Whether to show local desktop notifications
    pub notifications_enabled: bool,
}

impl Default for ClipboardMonitorConfig {
    fn default() -> Self {
        Self {
            poll_interval_ms: 500,
            max_scan_length: 50_000,
            max_excerpt_length: 500,
            builtin_dlp_enabled: true,
            notifications_enabled: true,
        }
    }
}

impl ClipboardMonitorConfig {
    pub fn from_app_config(_config: &AppConfig) -> Self {
        // Could be extended to read from AppConfig fields
        Self::default()
    }
}

/// Start clipboard monitoring loop.
/// Polls the system clipboard every N ms, checks content against:
///   1. Server-synced DLP rules (via RuleEngine)
///   2. Built-in DLP patterns (credit cards, SSN, API keys, etc.)
///
/// Logs events with matched pattern metadata.
pub async fn start_monitoring(
    rule_engine: Arc<RuleEngine>,
    event_queue: Arc<EventQueue>,
    monitor_config: ClipboardMonitorConfig,
) -> anyhow::Result<()> {
    info!(
        poll_ms = monitor_config.poll_interval_ms,
        builtin_dlp = monitor_config.builtin_dlp_enabled,
        "Clipboard monitor started"
    );

    let mut poll_interval = interval(Duration::from_millis(monitor_config.poll_interval_ms));
    let mut last_content_hash: Option<String> = None;

    // Compile built-in DLP patterns once
    let builtin_patterns: Vec<(&str, regex::Regex, &str)> = if monitor_config.builtin_dlp_enabled {
        BUILTIN_DLP_PATTERNS
            .iter()
            .filter_map(|(name, pattern, desc)| {
                match regex::Regex::new(pattern) {
                    Ok(re) => Some((*name, re, *desc)),
                    Err(e) => {
                        warn!(pattern_name = name, error = %e, "Failed to compile built-in DLP pattern");
                        None
                    }
                }
            })
            .collect()
    } else {
        Vec::new()
    };

    loop {
        poll_interval.tick().await;

        // Get current clipboard text content
        let content = match get_clipboard_text() {
            Some(text) if !text.is_empty() => text,
            _ => continue,
        };

        // Compute hash to detect changes
        let hash = compute_hash(&content);
        if last_content_hash.as_deref() == Some(&hash) {
            continue; // No change
        }
        last_content_hash = Some(hash.clone());

        debug!(len = content.len(), "Clipboard content changed");

        // Truncate content for scanning if too long
        let scan_content = truncate(&content, monitor_config.max_scan_length);

        // --- Phase 1: Evaluate against server-synced rules ---
        let rule_result = rule_engine.evaluate(&scan_content, RuleTarget::Clipboard).await;

        // --- Phase 2: Built-in DLP pattern scan ---
        let dlp_matches = scan_builtin_patterns(&scan_content, &builtin_patterns);

        // Determine final action based on both phases
        let excerpt = truncate(&content, monitor_config.max_excerpt_length);

        match rule_result {
            EvaluationResult::Blocked { rule_id, rule_name, message: _ } => {
                info!(%rule_name, "Clipboard content matched blocking rule");
                let metadata = build_metadata(&dlp_matches, Some(&rule_name));

                if monitor_config.notifications_enabled {
                    show_notification(
                        "Icon - Contenu sensible détecté",
                        &format!("Règle déclenchée : {}", rule_name),
                    );
                }

                event_queue.log_event_with_metadata(
                    "clipboard_block",
                    None, None,
                    Some(&hash),
                    Some(&excerpt),
                    None,
                    Some(&rule_id),
                    Some("critical"),
                    Some(&metadata),
                ).await;
            }
            EvaluationResult::Alerted { rule_id, rule_name, severity } => {
                info!(%rule_name, "Clipboard content triggered alert");
                let sev = format!("{:?}", severity).to_lowercase();
                let metadata = build_metadata(&dlp_matches, Some(&rule_name));

                if monitor_config.notifications_enabled && sev == "critical" {
                    show_notification(
                        "Icon - Alerte presse-papier",
                        &format!("Règle : {}", rule_name),
                    );
                }

                event_queue.log_event_with_metadata(
                    "clipboard_alert",
                    None, None,
                    Some(&hash),
                    Some(&excerpt),
                    None,
                    Some(&rule_id),
                    Some(&sev),
                    Some(&metadata),
                ).await;
            }
            EvaluationResult::Logged { rule_id } => {
                // If no server rule matched but DLP patterns did, escalate to alert
                if !dlp_matches.is_empty() {
                    let metadata = build_metadata(&dlp_matches, None);
                    info!(
                        patterns = dlp_matches.len(),
                        "Built-in DLP patterns matched clipboard content"
                    );

                    if monitor_config.notifications_enabled {
                        let pattern_names: Vec<&str> = dlp_matches.iter().map(|m| m.name).collect();
                        show_notification(
                            "Icon - Données sensibles détectées",
                            &format!("Patterns : {}", pattern_names.join(", ")),
                        );
                    }

                    event_queue.log_event_with_metadata(
                        "clipboard_alert",
                        None, None,
                        Some(&hash),
                        Some(&excerpt),
                        None,
                        rule_id.as_deref(),
                        Some("warning"),
                        Some(&metadata),
                    ).await;
                } else {
                    debug!("Clipboard content logged (no sensitive patterns)");
                    event_queue.log_event(
                        "clipboard_log",
                        None, None,
                        Some(&hash),
                        Some(&truncate(&content, 200)),
                        None,
                        rule_id.as_deref(),
                        Some("info"),
                    ).await;
                }
            }
            EvaluationResult::NoMatch => {
                // Even without rule match, check built-in DLP
                if !dlp_matches.is_empty() {
                    let metadata = build_metadata(&dlp_matches, None);
                    info!(
                        patterns = dlp_matches.len(),
                        "Built-in DLP patterns matched clipboard (no server rule)"
                    );

                    if monitor_config.notifications_enabled {
                        let pattern_names: Vec<&str> = dlp_matches.iter().map(|m| m.name).collect();
                        show_notification(
                            "Icon - Données sensibles détectées",
                            &format!("Patterns : {}", pattern_names.join(", ")),
                        );
                    }

                    event_queue.log_event_with_metadata(
                        "clipboard_alert",
                        None, None,
                        Some(&hash),
                        Some(&excerpt),
                        None,
                        None,
                        Some("warning"),
                        Some(&metadata),
                    ).await;
                }
                // No match at all → nothing to report
            }
        }
    }
}

/// Result from scanning a single built-in DLP pattern
struct DlpMatch<'a> {
    name: &'a str,
    description: &'a str,
    match_count: usize,
    /// Redacted sample matches (first 3, partially masked)
    samples: Vec<String>,
}

/// Scan content against all compiled built-in DLP patterns
fn scan_builtin_patterns<'a>(
    content: &str,
    patterns: &'a [(&str, regex::Regex, &str)],
) -> Vec<DlpMatch<'a>> {
    let mut matches = Vec::new();

    for (name, regex, desc) in patterns {
        let found: Vec<regex::Match> = regex.find_iter(content).collect();
        if !found.is_empty() {
            let samples: Vec<String> = found.iter()
                .take(3)
                .map(|m| redact_match(m.as_str()))
                .collect();

            matches.push(DlpMatch {
                name,
                description: desc,
                match_count: found.len(),
                samples,
            });
        }
    }

    matches
}

/// Redact a matched value: show first 4 chars + mask the rest
fn redact_match(value: &str) -> String {
    let chars: Vec<char> = value.chars().collect();
    if chars.len() <= 4 {
        "*".repeat(chars.len())
    } else {
        let visible: String = chars[..4].iter().collect();
        format!("{}{}",visible, "*".repeat(chars.len() - 4))
    }
}

/// Build JSON metadata string for DLP matches
fn build_metadata(dlp_matches: &[DlpMatch], rule_name: Option<&str>) -> String {
    let dlp_data: Vec<serde_json::Value> = dlp_matches.iter().map(|m| {
        json!({
            "pattern": m.name,
            "description": m.description,
            "count": m.match_count,
            "samples": m.samples,
        })
    }).collect();

    let mut meta = json!({});
    if !dlp_data.is_empty() {
        meta["dlp_matches"] = json!(dlp_data);
    }
    if let Some(name) = rule_name {
        meta["triggered_rule"] = json!(name);
    }
    meta.to_string()
}

/// Show a desktop notification (platform-specific, best-effort)
fn show_notification(title: &str, body: &str) {
    #[cfg(target_os = "macos")]
    {
        // Use osascript for macOS notifications
        let script = format!(
            r#"display notification "{}" with title "{}""#,
            body.replace('"', r#"\""#),
            title.replace('"', r#"\""#),
        );
        let _ = std::process::Command::new("osascript")
            .args(["-e", &script])
            .spawn();
    }

    #[cfg(target_os = "windows")]
    {
        // Use PowerShell for Windows toast notifications
        let script = format!(
            r#"[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null; $n = New-Object System.Windows.Forms.NotifyIcon; $n.Icon = [System.Drawing.SystemIcons]::Warning; $n.Visible = $true; $n.ShowBalloonTip(5000, '{}', '{}', 'Warning'); Start-Sleep -Seconds 6; $n.Dispose()"#,
            title.replace('\'', "''"),
            body.replace('\'', "''"),
        );
        let _ = std::process::Command::new("powershell")
            .args(["-WindowStyle", "Hidden", "-Command", &script])
            .spawn();
    }
}

/// Get the current clipboard text (platform-specific)
fn get_clipboard_text() -> Option<String> {
    #[cfg(target_os = "macos")]
    {
        super::macos::get_clipboard_text()
    }

    #[cfg(target_os = "windows")]
    {
        super::windows::get_clipboard_text()
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        None
    }
}

fn compute_hash(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    hex::encode(hasher.finalize())
}

fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        // Truncate at char boundary
        let mut end = max_len;
        while end > 0 && !s.is_char_boundary(end) {
            end -= 1;
        }
        format!("{}...", &s[..end])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_redact_match_short() {
        assert_eq!(redact_match("abc"), "***");
    }

    #[test]
    fn test_redact_match_long() {
        assert_eq!(redact_match("4532015112830366"), "4532************");
    }

    #[test]
    fn test_truncate_within_limit() {
        assert_eq!(truncate("hello", 10), "hello");
    }

    #[test]
    fn test_truncate_exceeds_limit() {
        let result = truncate("hello world this is long", 10);
        assert!(result.len() <= 13); // 10 + "..."
        assert!(result.ends_with("..."));
    }

    #[test]
    fn test_scan_builtin_patterns_credit_card() {
        let patterns: Vec<(&str, regex::Regex, &str)> = BUILTIN_DLP_PATTERNS
            .iter()
            .filter_map(|(name, pattern, desc)| {
                regex::Regex::new(pattern).ok().map(|re| (*name, re, *desc))
            })
            .collect();

        let content = "Voici ma carte : 4532015112830366 pour le paiement";
        let matches = scan_builtin_patterns(content, &patterns);
        assert!(!matches.is_empty());
        assert_eq!(matches[0].name, "credit_card");
        assert_eq!(matches[0].match_count, 1);
        assert!(matches[0].samples[0].starts_with("4532"));
    }

    #[test]
    fn test_scan_builtin_patterns_api_key() {
        let patterns: Vec<(&str, regex::Regex, &str)> = BUILTIN_DLP_PATTERNS
            .iter()
            .filter_map(|(name, pattern, desc)| {
                regex::Regex::new(pattern).ok().map(|re| (*name, re, *desc))
            })
            .collect();

        let content = "api_key: sk_live_abcdefghij1234567890xyz";
        let matches = scan_builtin_patterns(content, &patterns);
        let api_match = matches.iter().find(|m| m.name == "api_key_generic");
        assert!(api_match.is_some());
    }

    #[test]
    fn test_scan_builtin_patterns_private_key() {
        let patterns: Vec<(&str, regex::Regex, &str)> = BUILTIN_DLP_PATTERNS
            .iter()
            .filter_map(|(name, pattern, desc)| {
                regex::Regex::new(pattern).ok().map(|re| (*name, re, *desc))
            })
            .collect();

        let content = "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAK...";
        let matches = scan_builtin_patterns(content, &patterns);
        let pk_match = matches.iter().find(|m| m.name == "private_key");
        assert!(pk_match.is_some());
    }

    #[test]
    fn test_scan_no_match() {
        let patterns: Vec<(&str, regex::Regex, &str)> = BUILTIN_DLP_PATTERNS
            .iter()
            .filter_map(|(name, pattern, desc)| {
                regex::Regex::new(pattern).ok().map(|re| (*name, re, *desc))
            })
            .collect();

        let content = "Bonjour, comment allez-vous ?";
        let matches = scan_builtin_patterns(content, &patterns);
        assert!(matches.is_empty());
    }

    #[test]
    fn test_build_metadata_with_dlp() {
        let dlp = vec![DlpMatch {
            name: "credit_card",
            description: "Numéro de carte bancaire",
            match_count: 1,
            samples: vec!["4532************".to_string()],
        }];
        let meta = build_metadata(&dlp, Some("rule-test"));
        let parsed: serde_json::Value = serde_json::from_str(&meta).unwrap();
        assert!(parsed["dlp_matches"].is_array());
        assert_eq!(parsed["triggered_rule"], "rule-test");
    }

    #[test]
    fn test_compute_hash_deterministic() {
        let h1 = compute_hash("test content");
        let h2 = compute_hash("test content");
        assert_eq!(h1, h2);
        assert_ne!(h1, compute_hash("different"));
    }
}
