use std::sync::Arc;

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tracing::{debug, info};

use crate::config::AppConfig;
use crate::proxy::domain_filter::DomainFilter;
use crate::proxy::request_parser;
use crate::proxy::tls::CaManager;
use crate::rules::engine::RuleEngine;
use crate::rules::models::{EvaluationResult, RuleTarget};
use crate::sync::queue::EventQueue;

/// Maximum size we'll read from a single HTTP message (16 MB)
const MAX_READ_SIZE: usize = 16 * 1024 * 1024;

/// Initial read buffer size (64 KB)
const INITIAL_BUF_SIZE: usize = 64 * 1024;

/// Start the local MITM proxy that intercepts AI platform traffic
pub async fn start_proxy(
    config: AppConfig,
    rule_engine: Arc<RuleEngine>,
    event_queue: Arc<EventQueue>,
) -> anyhow::Result<()> {
    let bind_addr = format!("127.0.0.1:{}", config.proxy_port);
    let listener = TcpListener::bind(&bind_addr).await?;
    info!(addr = %bind_addr, "MITM proxy listening");

    // Initialize TLS CA manager (loads or generates CA cert)
    let ca_manager = CaManager::load_or_create(&config.data_dir)?;
    info!("TLS CA manager initialized");

    let domain_filter = Arc::new(DomainFilter::with_defaults());

    loop {
        let (stream, peer_addr) = listener.accept().await?;
        debug!(%peer_addr, "New connection");

        let re = rule_engine.clone();
        let eq = event_queue.clone();
        let df = domain_filter.clone();
        let ca = ca_manager.clone();

        tokio::spawn(async move {
            if let Err(e) = handle_connection(stream, re, eq, df, ca).await {
                debug!(error = %e, "Connection handling error");
            }
        });
    }
}

/// Handle a single proxied connection (HTTP CONNECT tunnel)
async fn handle_connection(
    mut client_stream: tokio::net::TcpStream,
    rule_engine: Arc<RuleEngine>,
    event_queue: Arc<EventQueue>,
    domain_filter: Arc<DomainFilter>,
    ca_manager: Arc<CaManager>,
) -> anyhow::Result<()> {
    // Read the initial CONNECT request
    let mut buf = vec![0u8; 8192];
    let n = client_stream.read(&mut buf).await?;
    if n == 0 {
        return Ok(());
    }
    let request_line = String::from_utf8_lossy(&buf[..n]);

    // Parse CONNECT host:port
    let (host, port) = parse_connect_target(&request_line)
        .ok_or_else(|| anyhow::anyhow!("Failed to parse CONNECT target"))?;

    // --- Not an AI domain: tunnel directly without inspection ---
    if !domain_filter.should_intercept(&host).await {
        return tunnel_direct(&mut client_stream, &host, port).await;
    }

    // --- Domain is fully blocked ---
    if domain_filter.is_blocked(&host).await {
        let blocked = request_parser::build_block_response(
            "L'accès à cette plateforme IA est interdit par la politique de sécurité GS2E.",
            "Blocage de domaine",
        );
        client_stream
            .write_all(b"HTTP/1.1 200 Connection Established\r\n\r\n")
            .await?;

        // We need to do a TLS handshake to deliver the block page over HTTPS
        let acceptor = ca_manager.make_tls_acceptor(&host).await?;
        let mut tls_client = acceptor.accept(client_stream).await?;
        tls_client.write_all(&blocked).await?;
        tls_client.shutdown().await?;

        let platform = request_parser::identify_platform(&host).unwrap_or("unknown");
        event_queue
            .log_event("domain_block", Some(platform), Some(&host), None, None, None, None, Some("critical"))
            .await;
        return Ok(());
    }

    // --- Domain is monitored: perform full MITM TLS interception ---
    let platform = request_parser::identify_platform(&host).unwrap_or("unknown");

    // Step 1: Respond 200 to the CONNECT request
    client_stream
        .write_all(b"HTTP/1.1 200 Connection Established\r\n\r\n")
        .await?;

    // Step 2: TLS handshake with the CLIENT using our forged certificate
    let acceptor = ca_manager.make_tls_acceptor(&host).await?;
    let mut tls_client = match acceptor.accept(client_stream).await {
        Ok(s) => s,
        Err(e) => {
            debug!(host = %host, error = %e, "TLS handshake with client failed");
            return Ok(());
        }
    };
    debug!(host = %host, "TLS handshake with client completed");

    // Step 3: Connect to the UPSTREAM server and perform TLS handshake
    let target_addr = format!("{}:{}", host, port);
    let upstream_tcp = tokio::net::TcpStream::connect(&target_addr).await?;
    let connector = ca_manager.make_tls_connector();
    let server_name = CaManager::server_name(&host)?;
    let mut tls_upstream = connector.connect(server_name, upstream_tcp).await?;
    debug!(host = %host, "TLS handshake with upstream completed");

    // Step 4: Bidirectional proxying with inspection
    // We process request/response pairs in a loop (HTTP/1.1 keep-alive)
    loop {
        // --- Read the HTTP request from the client ---
        let request_data = match read_http_message(&mut tls_client).await {
            Ok(data) if data.is_empty() => break, // Client closed connection
            Ok(data) => data,
            Err(_) => break,
        };

        // Parse the HTTP request
        let parsed_request = request_parser::parse_raw_request(&request_data);

        // Determine if this is an API endpoint that carries prompts
        let is_api = parsed_request
            .as_ref()
            .map(|r| request_parser::is_api_endpoint(&r.path, platform))
            .unwrap_or(false);

        if is_api {
            if let Some(ref req) = parsed_request {
                // Extract the prompt from the request body
                let prompt = request_parser::extract_prompt(&req.body, platform);

                if let Some(ref prompt_text) = prompt {
                    info!(
                        host = %host,
                        platform,
                        path = %req.path,
                        prompt_len = prompt_text.len(),
                        "Intercepted AI prompt"
                    );

                    // --- Evaluate the prompt against the rule engine ---
                    let result = rule_engine.evaluate(prompt_text, RuleTarget::Prompt).await;

                    match result {
                        EvaluationResult::Blocked {
                            rule_id,
                            rule_name,
                            message,
                        } => {
                            info!(%rule_name, "BLOCKED prompt");

                            // Send block page to client
                            let block_response =
                                request_parser::build_block_response(&message, &rule_name);
                            tls_client.write_all(&block_response).await?;

                            // Log the blocked event
                            let hash = request_parser::content_hash(&req.body);
                            event_queue
                                .log_event(
                                    "block",
                                    Some(platform),
                                    Some(&host),
                                    Some(&hash),
                                    Some(&request_parser::truncate(prompt_text, 500)),
                                    None,
                                    Some(&rule_id),
                                    Some("critical"),
                                )
                                .await;

                            // Don't forward to upstream — continue to next request
                            continue;
                        }
                        EvaluationResult::Alerted {
                            rule_id,
                            rule_name,
                            severity,
                        } => {
                            info!(%rule_name, "Alert on prompt, forwarding anyway");
                            let hash = request_parser::content_hash(&req.body);
                            let sev = format!("{:?}", severity).to_lowercase();
                            event_queue
                                .log_event(
                                    "alert",
                                    Some(platform),
                                    Some(&host),
                                    Some(&hash),
                                    Some(&request_parser::truncate(prompt_text, 500)),
                                    None,
                                    Some(&rule_id),
                                    Some(&sev),
                                )
                                .await;
                            // Fall through to forward
                        }
                        EvaluationResult::Logged { rule_id } => {
                            let hash = request_parser::content_hash(&req.body);
                            event_queue
                                .log_event(
                                    "prompt",
                                    Some(platform),
                                    Some(&host),
                                    Some(&hash),
                                    Some(&request_parser::truncate(prompt_text, 500)),
                                    None,
                                    rule_id.as_deref(),
                                    Some("info"),
                                )
                                .await;
                        }
                        EvaluationResult::NoMatch => {
                            // Log the prompt even if no rule matched
                            let hash = request_parser::content_hash(&req.body);
                            event_queue
                                .log_event(
                                    "prompt",
                                    Some(platform),
                                    Some(&host),
                                    Some(&hash),
                                    Some(&request_parser::truncate(prompt_text, 500)),
                                    None,
                                    None,
                                    Some("info"),
                                )
                                .await;
                        }
                    }
                }
            }
        }

        // --- Forward the request to upstream ---
        if let Err(e) = tls_upstream.write_all(&request_data).await {
            debug!(error = %e, "Failed to write to upstream");
            break;
        }

        // --- Read the response from upstream ---
        let response_data = match read_http_message(&mut tls_upstream).await {
            Ok(data) if data.is_empty() => break,
            Ok(data) => data,
            Err(_) => break,
        };

        // If this was an API endpoint, try to extract and log the response
        if is_api {
            if parsed_request.is_some() {
                let response_text = request_parser::extract_response(&response_data, platform);
                if let Some(ref resp_text) = response_text {
                    let hash = request_parser::content_hash(&response_data);

                    // Evaluate the response against rules too
                    let result = rule_engine.evaluate(resp_text, RuleTarget::Response).await;
                    let (event_type, rule_id, severity) = match result {
                        EvaluationResult::Alerted {
                            rule_id, severity, ..
                        } => {
                            let sev = format!("{:?}", severity).to_lowercase();
                            ("response_alert", Some(rule_id), sev)
                        }
                        EvaluationResult::Logged { rule_id } => {
                            ("response", rule_id, "info".to_string())
                        }
                        _ => ("response", None, "info".to_string()),
                    };

                    event_queue
                        .log_event(
                            event_type,
                            Some(platform),
                            Some(&host),
                            Some(&hash),
                            None,
                            Some(&request_parser::truncate(resp_text, 500)),
                            rule_id.as_deref(),
                            Some(&severity),
                        )
                        .await;
                }
            }
        }

        // --- Forward the response to the client ---
        if let Err(e) = tls_client.write_all(&response_data).await {
            debug!(error = %e, "Failed to write response to client");
            break;
        }
    }

    // Graceful shutdown
    let _ = tls_client.shutdown().await;
    let _ = tls_upstream.shutdown().await;

    Ok(())
}

/// Read a complete HTTP message (headers + body) from a TLS stream.
///
/// Handles:
/// - Content-Length: reads exactly that many body bytes
/// - Transfer-Encoding: chunked: reads until the final 0-length chunk
/// - No body: returns just the headers (for GET, HEAD, etc.)
async fn read_http_message<S: AsyncReadExt + Unpin>(stream: &mut S) -> anyhow::Result<Vec<u8>> {
    let mut buf = vec![0u8; INITIAL_BUF_SIZE];
    let mut total = 0;

    // Phase 1: Read until we have the complete headers (\r\n\r\n)
    loop {
        if total >= MAX_READ_SIZE {
            anyhow::bail!("HTTP message too large");
        }

        if total >= buf.len() {
            buf.resize(buf.len() * 2, 0);
        }

        let n = stream.read(&mut buf[total..]).await?;
        if n == 0 {
            return Ok(buf[..total].to_vec()); // Connection closed
        }
        total += n;

        // Check if we have the complete headers
        if let Some(header_end) = find_header_end(&buf[..total]) {
            let body_start = header_end + 4; // after \r\n\r\n
            let header_section = String::from_utf8_lossy(&buf[..header_end]);

            // Determine body length
            let content_length = extract_content_length(&header_section);
            let is_chunked = header_section
                .to_lowercase()
                .contains("transfer-encoding: chunked");

            if let Some(cl) = content_length {
                // Content-Length mode: read exactly `cl` bytes of body
                let expected_total = body_start + cl;
                if expected_total > MAX_READ_SIZE {
                    anyhow::bail!("HTTP message body too large: {} bytes", cl);
                }

                while total < expected_total {
                    if total >= buf.len() {
                        buf.resize(std::cmp::min(buf.len() * 2, expected_total + 1024), 0);
                    }
                    let n = stream.read(&mut buf[total..]).await?;
                    if n == 0 {
                        break; // Connection closed prematurely
                    }
                    total += n;
                }

                return Ok(buf[..total].to_vec());
            } else if is_chunked {
                // Chunked transfer encoding: read until 0\r\n\r\n
                loop {
                    if total >= MAX_READ_SIZE {
                        anyhow::bail!("Chunked message too large");
                    }

                    // Check if we've reached the final chunk
                    let body_so_far = &buf[body_start..total];
                    if is_chunked_complete(body_so_far) {
                        return Ok(buf[..total].to_vec());
                    }

                    if total >= buf.len() {
                        buf.resize(buf.len() * 2, 0);
                    }
                    let n = stream.read(&mut buf[total..]).await?;
                    if n == 0 {
                        return Ok(buf[..total].to_vec());
                    }
                    total += n;
                }
            } else {
                // No Content-Length and not chunked → body is empty
                // (or the server will close the connection to signal end)
                return Ok(buf[..total].to_vec());
            }
        }
    }
}

/// Find the position of \r\n\r\n in the buffer
fn find_header_end(data: &[u8]) -> Option<usize> {
    data.windows(4)
        .position(|w| w == b"\r\n\r\n")
}

/// Extract Content-Length value from headers
fn extract_content_length(headers: &str) -> Option<usize> {
    for line in headers.lines() {
        if let Some(value) = line.strip_prefix("Content-Length:").or_else(|| line.strip_prefix("content-length:")) {
            return value.trim().parse().ok();
        }
        // Case-insensitive check
        let lower = line.to_lowercase();
        if lower.starts_with("content-length:") {
            let parts: Vec<&str> = line.splitn(2, ':').collect();
            if parts.len() == 2 {
                return parts[1].trim().parse().ok();
            }
        }
    }
    None
}

/// Check if a chunked transfer body is complete (ends with 0\r\n\r\n)
fn is_chunked_complete(body: &[u8]) -> bool {
    // The final chunk is "0\r\n\r\n" or "0\r\n" followed by optional trailers and "\r\n"
    if body.len() >= 5 {
        let tail = &body[body.len().saturating_sub(7)..];
        // Look for "0\r\n\r\n" pattern
        tail.windows(5).any(|w| w == b"0\r\n\r\n")
    } else {
        false
    }
}

/// Parse CONNECT target, returns (host, port)
fn parse_connect_target(request: &str) -> Option<(String, u16)> {
    let first_line = request.lines().next()?;
    let parts: Vec<&str> = first_line.split_whitespace().collect();

    if parts.len() >= 2 && parts[0] == "CONNECT" {
        let host_port = parts[1];
        let mut split = host_port.rsplitn(2, ':');
        let port: u16 = split.next()?.parse().unwrap_or(443);
        let host = split.next()?.to_string();
        Some((host, port))
    } else {
        None
    }
}

/// Tunnel a connection directly without TLS inspection (for non-AI domains)
async fn tunnel_direct(
    client: &mut tokio::net::TcpStream,
    host: &str,
    port: u16,
) -> anyhow::Result<()> {
    let target_addr = format!("{}:{}", host, port);
    let mut target = tokio::net::TcpStream::connect(&target_addr).await?;

    client
        .write_all(b"HTTP/1.1 200 Connection Established\r\n\r\n")
        .await?;

    tokio::io::copy_bidirectional(client, &mut target).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_connect_target() {
        let req = "CONNECT api.openai.com:443 HTTP/1.1\r\nHost: api.openai.com\r\n\r\n";
        let (host, port) = parse_connect_target(req).unwrap();
        assert_eq!(host, "api.openai.com");
        assert_eq!(port, 443);
    }

    #[test]
    fn test_parse_connect_custom_port() {
        let req = "CONNECT example.com:8443 HTTP/1.1\r\n\r\n";
        let (host, port) = parse_connect_target(req).unwrap();
        assert_eq!(host, "example.com");
        assert_eq!(port, 8443);
    }

    #[test]
    fn test_extract_content_length() {
        assert_eq!(
            extract_content_length("Content-Length: 42\r\nHost: x"),
            Some(42)
        );
        assert_eq!(
            extract_content_length("content-length: 100\r\n"),
            Some(100)
        );
        assert_eq!(
            extract_content_length("Host: x\r\nAccept: */*"),
            None
        );
    }

    #[test]
    fn test_find_header_end() {
        let data = b"GET / HTTP/1.1\r\nHost: x\r\n\r\nbody";
        assert_eq!(find_header_end(data), Some(23));

        let data = b"GET / HTTP/1.1\r\nHost: x\r\n";
        assert_eq!(find_header_end(data), None);
    }

    #[test]
    fn test_chunked_complete() {
        assert!(is_chunked_complete(b"hello\r\n0\r\n\r\n"));
        assert!(!is_chunked_complete(b"hello\r\n"));
        assert!(!is_chunked_complete(b""));
    }
}
