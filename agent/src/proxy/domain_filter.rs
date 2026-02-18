use std::collections::HashSet;
use tokio::sync::RwLock;

/// Manages the list of AI domains to intercept
pub struct DomainFilter {
    domains: RwLock<HashSet<String>>,
    blocked_domains: RwLock<HashSet<String>>,
}

impl DomainFilter {
    /// Default AI domains to monitor
    pub fn with_defaults() -> Self {
        let defaults: HashSet<String> = [
            // OpenAI / ChatGPT
            "api.openai.com",
            "chat.openai.com",
            "chatgpt.com",
            // Anthropic / Claude
            "claude.ai",
            "api.anthropic.com",
            // Microsoft / Copilot
            "copilot.microsoft.com",
            "github.copilot.com",
            // Google / Gemini
            "gemini.google.com",
            "generativelanguage.googleapis.com",
            // HuggingFace
            "huggingface.co",
            // Mistral
            "api.mistral.ai",
            "chat.mistral.ai",
            // Perplexity
            "api.perplexity.ai",
            "www.perplexity.ai",
        ]
        .iter()
        .map(|s| s.to_string())
        .collect();

        Self {
            domains: RwLock::new(defaults),
            blocked_domains: RwLock::new(HashSet::new()),
        }
    }

    /// Check if a domain should be intercepted (monitored)
    pub async fn should_intercept(&self, host: &str) -> bool {
        let domains = self.domains.read().await;
        // Check exact match or subdomain match
        domains.iter().any(|d| host == d.as_str() || host.ends_with(&format!(".{}", d)))
    }

    /// Check if a domain is completely blocked
    pub async fn is_blocked(&self, host: &str) -> bool {
        let blocked = self.blocked_domains.read().await;
        blocked.iter().any(|d| host == d.as_str() || host.ends_with(&format!(".{}", d)))
    }

    /// Update domains from server-provided list
    pub async fn update_domains(&self, monitored: Vec<(String, bool)>) {
        let mut domains = self.domains.write().await;
        let mut blocked = self.blocked_domains.write().await;

        domains.clear();
        blocked.clear();

        for (domain, is_blocked) in monitored {
            domains.insert(domain.clone());
            if is_blocked {
                blocked.insert(domain);
            }
        }
    }

    /// Generate a PAC (Proxy Auto-Config) file content
    /// that redirects only monitored domains to the local proxy
    pub async fn generate_pac(&self, proxy_port: u16) -> String {
        let domains = self.domains.read().await;

        let conditions: Vec<String> = domains
            .iter()
            .map(|d| format!("        dnsDomainIs(host, \"{}\")", d))
            .collect();

        format!(
            r#"function FindProxyForURL(url, host) {{
    if (
{}
    ) {{
        return "PROXY 127.0.0.1:{}";
    }}
    return "DIRECT";
}}"#,
            conditions.join(" ||\n"),
            proxy_port,
        )
    }
}
