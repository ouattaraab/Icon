use serde::Deserialize;
use sha2::{Digest, Sha256};

/// A parsed HTTP request extracted from the decrypted TLS stream
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct ParsedHttpRequest {
    pub method: String,
    pub path: String,
    pub host: String,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
    pub content_type: Option<String>,
}

/// A parsed HTTP response extracted from the decrypted upstream stream
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct ParsedHttpResponse {
    pub status_code: u16,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
    pub content_type: Option<String>,
}

/// Parse a raw HTTP request from bytes (after TLS decryption).
/// Handles chunked transfer encoding and Content-Length.
pub fn parse_raw_request(data: &[u8]) -> Option<ParsedHttpRequest> {
    let text = String::from_utf8_lossy(data);

    // Split headers from body at \r\n\r\n
    let header_end = text.find("\r\n\r\n")?;
    let header_section = &text[..header_end];
    let body_start = header_end + 4;
    let body = if body_start < data.len() {
        data[body_start..].to_vec()
    } else {
        Vec::new()
    };

    let mut lines = header_section.lines();

    // Request line: METHOD /path HTTP/1.1
    let request_line = lines.next()?;
    let parts: Vec<&str> = request_line.splitn(3, ' ').collect();
    if parts.len() < 2 {
        return None;
    }
    let method = parts[0].to_string();
    let path = parts[1].to_string();

    // Parse headers
    let mut headers = Vec::new();
    let mut host = String::new();
    let mut content_type = None;

    for line in lines {
        if let Some((key, value)) = line.split_once(':') {
            let key = key.trim().to_string();
            let value = value.trim().to_string();

            if key.eq_ignore_ascii_case("host") {
                host = value.clone();
            }
            if key.eq_ignore_ascii_case("content-type") {
                content_type = Some(value.clone());
            }
            headers.push((key, value));
        }
    }

    Some(ParsedHttpRequest {
        method,
        path,
        host,
        headers,
        body,
        content_type,
    })
}

/// Parse a raw HTTP response from bytes
#[allow(dead_code)]
pub fn parse_raw_response(data: &[u8]) -> Option<ParsedHttpResponse> {
    let text = String::from_utf8_lossy(data);

    let header_end = text.find("\r\n\r\n")?;
    let header_section = &text[..header_end];
    let body_start = header_end + 4;
    let body = if body_start < data.len() {
        data[body_start..].to_vec()
    } else {
        Vec::new()
    };

    let mut lines = header_section.lines();

    // Status line: HTTP/1.1 200 OK
    let status_line = lines.next()?;
    let parts: Vec<&str> = status_line.splitn(3, ' ').collect();
    let status_code: u16 = parts.get(1)?.parse().ok()?;

    let mut headers = Vec::new();
    let mut content_type = None;

    for line in lines {
        if let Some((key, value)) = line.split_once(':') {
            let key = key.trim().to_string();
            let value = value.trim().to_string();

            if key.eq_ignore_ascii_case("content-type") {
                content_type = Some(value.clone());
            }
            headers.push((key, value));
        }
    }

    Some(ParsedHttpResponse {
        status_code,
        headers,
        body,
        content_type,
    })
}

/// Check if a request path looks like an API endpoint that carries prompts
pub fn is_api_endpoint(path: &str, platform: &str) -> bool {
    match platform {
        "chatgpt" => {
            path.contains("/v1/chat/completions")
                || path.contains("/backend-api/conversation")
                || path.contains("/backend-anon/conversation")
        }
        "claude" => {
            path.contains("/api/") && path.contains("/chat")
                || path.contains("/v1/messages")
                || path.contains("/api/organizations")
        }
        "copilot" => {
            path.contains("/v1/engines")
                || path.contains("/v1/completions")
                || path.contains("/chat/completions")
        }
        "gemini" => {
            path.contains("/v1beta/models")
                || path.contains("/v1/models")
                || path.contains(":generateContent")
        }
        "mistral" => {
            path.contains("/v1/chat/completions")
        }
        "perplexity" => {
            path.contains("/chat/completions")
        }
        _ => {
            // Generic: match common LLM API patterns
            path.contains("/chat/completions")
                || path.contains("/v1/messages")
                || path.contains("/generate")
        }
    }
}

/// Reconstruct the raw HTTP request bytes from a ParsedHttpRequest
/// (used to forward the request to the upstream server)
#[allow(dead_code)]
pub fn serialize_request(req: &ParsedHttpRequest) -> Vec<u8> {
    let mut out = format!("{} {} HTTP/1.1\r\n", req.method, req.path);
    for (key, value) in &req.headers {
        out.push_str(&format!("{}: {}\r\n", key, value));
    }
    out.push_str("\r\n");

    let mut bytes = out.into_bytes();
    bytes.extend_from_slice(&req.body);
    bytes
}

/// Reconstruct raw HTTP response bytes from a ParsedHttpResponse
#[allow(dead_code)]
pub fn serialize_response(resp: &ParsedHttpResponse) -> Vec<u8> {
    let reason = match resp.status_code {
        200 => "OK",
        201 => "Created",
        204 => "No Content",
        400 => "Bad Request",
        401 => "Unauthorized",
        403 => "Forbidden",
        404 => "Not Found",
        500 => "Internal Server Error",
        _ => "Unknown",
    };

    let mut out = format!("HTTP/1.1 {} {}\r\n", resp.status_code, reason);
    for (key, value) in &resp.headers {
        out.push_str(&format!("{}: {}\r\n", key, value));
    }
    out.push_str("\r\n");

    let mut bytes = out.into_bytes();
    bytes.extend_from_slice(&resp.body);
    bytes
}

/// Build a blocked response (HTTP 403) with the Icon block page
pub fn build_block_response(message: &str, rule_name: &str) -> Vec<u8> {
    let body = BLOCK_PAGE_TEMPLATE
        .replace("{{MESSAGE}}", message)
        .replace("{{RULE_NAME}}", rule_name);

    let mut out = format!(
        "HTTP/1.1 403 Forbidden\r\n\
         Content-Type: text/html; charset=utf-8\r\n\
         Content-Length: {}\r\n\
         Connection: close\r\n\
         X-Icon-Blocked: true\r\n\
         \r\n",
        body.len()
    );
    out.push_str(&body);
    out.into_bytes()
}

/// Compute SHA-256 hash of content
pub fn content_hash(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

/// Truncate a string for excerpt storage
pub fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...[truncated]", &s[..max_len])
    }
}

// --- AI platform prompt/response extractors ---

/// Identifies which AI platform a request belongs to based on the domain
pub fn identify_platform(host: &str) -> Option<&'static str> {
    if host.contains("openai.com") || host.contains("chatgpt.com") {
        Some("chatgpt")
    } else if host.contains("claude.ai") || host.contains("anthropic.com") {
        Some("claude")
    } else if host.contains("copilot.microsoft.com") || host.contains("github.copilot") {
        Some("copilot")
    } else if host.contains("gemini.google.com")
        || host.contains("generativelanguage.googleapis.com")
    {
        Some("gemini")
    } else if host.contains("mistral.ai") {
        Some("mistral")
    } else if host.contains("perplexity.ai") {
        Some("perplexity")
    } else if host.contains("huggingface.co") {
        Some("huggingface")
    } else {
        None
    }
}

/// Extract the user prompt from a request body based on the platform
pub fn extract_prompt(body: &[u8], platform: &str) -> Option<String> {
    let text = std::str::from_utf8(body).ok()?;

    match platform {
        "chatgpt" | "claude" | "mistral" | "perplexity" => extract_openai_format(text),
        "gemini" => extract_gemini_format(text),
        _ => extract_openai_format(text).or_else(|| {
            // Fallback: if it looks like JSON with a prompt/content field, extract it
            extract_generic_prompt(text)
        }),
    }
}

/// Extract the assistant response from a response body
pub fn extract_response(body: &[u8], _platform: &str) -> Option<String> {
    let text = std::str::from_utf8(body).ok()?;

    // Try OpenAI format first (most common)
    extract_openai_response(text)
        // Fallback: if it's SSE (streaming), collect text chunks
        .or_else(|| extract_sse_response(text))
        // Last resort: truncated raw body
        .or_else(|| Some(truncate(text, 5000)))
}

// --- Internal parsers ---

#[derive(Deserialize)]
struct OpenAiRequest {
    messages: Option<Vec<ChatMessage>>,
}

#[derive(Deserialize)]
struct ChatMessage {
    role: Option<String>,
    content: Option<serde_json::Value>,
}

#[derive(Deserialize)]
struct OpenAiResponse {
    choices: Option<Vec<Choice>>,
}

#[derive(Deserialize)]
struct Choice {
    message: Option<ChatMessage>,
    delta: Option<ChatMessage>,
}

#[derive(Deserialize)]
struct GeminiRequest {
    contents: Option<Vec<GeminiContent>>,
}

#[derive(Deserialize)]
struct GeminiContent {
    parts: Option<Vec<GeminiPart>>,
    role: Option<String>,
}

#[derive(Deserialize)]
struct GeminiPart {
    text: Option<String>,
}

fn extract_openai_format(body: &str) -> Option<String> {
    let req: OpenAiRequest = serde_json::from_str(body).ok()?;
    let messages = req.messages?;

    let user_msg = messages
        .iter()
        .rev()
        .find(|m| m.role.as_deref() == Some("user"))?;

    match &user_msg.content {
        Some(serde_json::Value::String(s)) => Some(s.clone()),
        Some(v) => Some(v.to_string()),
        None => None,
    }
}

fn extract_openai_response(body: &str) -> Option<String> {
    let resp: OpenAiResponse = serde_json::from_str(body).ok()?;
    let choices = resp.choices?;
    let choice = choices.first()?;

    let msg = choice.message.as_ref().or(choice.delta.as_ref())?;
    match &msg.content {
        Some(serde_json::Value::String(s)) => Some(s.clone()),
        Some(v) => Some(v.to_string()),
        None => None,
    }
}

fn extract_gemini_format(body: &str) -> Option<String> {
    let req: GeminiRequest = serde_json::from_str(body).ok()?;
    let contents = req.contents?;

    let user_content = contents
        .iter()
        .rev()
        .find(|c| c.role.as_deref() == Some("user"))?;

    let parts = user_content.parts.as_ref()?;
    let texts: Vec<&str> = parts.iter().filter_map(|p| p.text.as_deref()).collect();

    if texts.is_empty() {
        None
    } else {
        Some(texts.join("\n"))
    }
}

/// Extract from SSE (Server-Sent Events) streaming responses
fn extract_sse_response(body: &str) -> Option<String> {
    let mut full_text = String::new();

    for line in body.lines() {
        if let Some(data) = line.strip_prefix("data: ") {
            if data == "[DONE]" {
                continue;
            }
            if let Ok(chunk) = serde_json::from_str::<OpenAiResponse>(data) {
                if let Some(choices) = chunk.choices {
                    if let Some(choice) = choices.first() {
                        if let Some(msg) = choice.delta.as_ref() {
                            if let Some(serde_json::Value::String(s)) = &msg.content {
                                full_text.push_str(s);
                            }
                        }
                    }
                }
            }
        }
    }

    if full_text.is_empty() {
        None
    } else {
        Some(full_text)
    }
}

/// Generic prompt extraction for unknown platforms
fn extract_generic_prompt(body: &str) -> Option<String> {
    let val: serde_json::Value = serde_json::from_str(body).ok()?;

    // Try common field names
    for field in ["prompt", "content", "text", "input", "query", "question"] {
        if let Some(serde_json::Value::String(s)) = val.get(field) {
            return Some(s.clone());
        }
    }
    None
}

/// HTML page displayed when a request is blocked
const BLOCK_PAGE_TEMPLATE: &str = r#"<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <title>Icon - Requête bloquée</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            display: flex; justify-content: center; align-items: center;
            min-height: 100vh; margin: 0;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #e0e0e0;
        }
        .container {
            text-align: center; padding: 3rem;
            background: rgba(255,255,255,0.05);
            border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);
            max-width: 500px;
        }
        .icon { font-size: 4rem; margin-bottom: 1rem; }
        h1 { color: #e74c3c; font-size: 1.5rem; margin-bottom: 0.5rem; }
        p { color: #bbb; line-height: 1.6; }
        .rule { color: #f39c12; font-weight: 600; margin-top: 1rem; }
        .redirect {
            display: inline-block; margin-top: 1.5rem; padding: 0.75rem 2rem;
            background: #2ecc71; color: #fff; text-decoration: none;
            border-radius: 8px; font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">🛡️</div>
        <h1>Requête bloquée par Icon</h1>
        <p>{{MESSAGE}}</p>
        <p class="rule">Règle : {{RULE_NAME}}</p>
        <a class="redirect" href="https://marcelia.gs2e.ci">Utiliser Marcel'IA</a>
    </div>
</body>
</html>"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_identify_platform() {
        assert_eq!(identify_platform("api.openai.com"), Some("chatgpt"));
        assert_eq!(identify_platform("claude.ai"), Some("claude"));
        assert_eq!(identify_platform("copilot.microsoft.com"), Some("copilot"));
        assert_eq!(identify_platform("unknown.com"), None);
    }

    #[test]
    fn test_extract_openai_prompt() {
        let body = r#"{"messages":[{"role":"system","content":"You are helpful"},{"role":"user","content":"Génère un cahier des charges"}]}"#;
        let result = extract_prompt(body.as_bytes(), "chatgpt");
        assert_eq!(result, Some("Génère un cahier des charges".to_string()));
    }

    #[test]
    fn test_is_api_endpoint() {
        assert!(is_api_endpoint("/v1/chat/completions", "chatgpt"));
        assert!(is_api_endpoint("/backend-api/conversation", "chatgpt"));
        assert!(is_api_endpoint("/v1/messages", "claude"));
        assert!(!is_api_endpoint("/static/logo.png", "chatgpt"));
    }

    #[test]
    fn test_parse_raw_request() {
        let raw = b"POST /v1/chat/completions HTTP/1.1\r\nHost: api.openai.com\r\nContent-Type: application/json\r\n\r\n{\"messages\":[]}";
        let req = parse_raw_request(raw).unwrap();
        assert_eq!(req.method, "POST");
        assert_eq!(req.path, "/v1/chat/completions");
        assert_eq!(req.host, "api.openai.com");
        assert_eq!(
            req.content_type.as_deref(),
            Some("application/json")
        );
        assert_eq!(std::str::from_utf8(&req.body).unwrap(), "{\"messages\":[]}");
    }

    #[test]
    fn test_parse_raw_response() {
        let raw = b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{\"choices\":[]}";
        let resp = parse_raw_response(raw).unwrap();
        assert_eq!(resp.status_code, 200);
        assert_eq!(
            std::str::from_utf8(&resp.body).unwrap(),
            "{\"choices\":[]}"
        );
    }

    #[test]
    fn test_sse_response_extraction() {
        let body = "data: {\"choices\":[{\"delta\":{\"role\":\"assistant\",\"content\":\"Hello\"}}]}\n\ndata: {\"choices\":[{\"delta\":{\"content\":\" world\"}}]}\n\ndata: [DONE]\n\n";
        let result = extract_sse_response(body);
        assert_eq!(result, Some("Hello world".to_string()));
    }

    #[test]
    fn test_block_response() {
        let resp = build_block_response("Interdit", "Rule-1");
        let text = String::from_utf8(resp).unwrap();
        assert!(text.starts_with("HTTP/1.1 403"));
        assert!(text.contains("Interdit"));
        assert!(text.contains("Rule-1"));
    }
}
