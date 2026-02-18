use std::collections::HashMap;
use std::sync::Mutex;

use regex::Regex;
use crate::rules::models::RuleCondition;

/// Type alias for the regex cache to reduce complexity.
type RegexCache = Mutex<HashMap<(String, bool), Result<Regex, String>>>;

/// Global regex cache to avoid recompiling patterns on every evaluation.
/// Key: (pattern, case_insensitive) → compiled Regex
static REGEX_CACHE: std::sync::LazyLock<RegexCache> =
    std::sync::LazyLock::new(|| Mutex::new(HashMap::new()));

/// Évalue si un contenu matche une condition de règle
pub fn matches_condition(content: &str, condition: &RuleCondition) -> bool {
    match condition {
        RuleCondition::Regex { pattern, case_insensitive } => {
            match get_or_compile_regex(pattern, *case_insensitive) {
                Ok(re) => re.is_match(content),
                Err(e) => {
                    tracing::warn!(pattern, error = %e, "Invalid regex pattern in rule");
                    false
                }
            }
        }

        RuleCondition::Keyword { keywords, match_all } => {
            let lower_content = content.to_lowercase();
            if *match_all {
                keywords.iter().all(|kw| lower_content.contains(&kw.to_lowercase()))
            } else {
                keywords.iter().any(|kw| lower_content.contains(&kw.to_lowercase()))
            }
        }

        RuleCondition::DomainList { domains } => {
            let lower_content = content.to_lowercase();
            domains.iter().any(|d| lower_content.contains(&d.to_lowercase()))
        }

        // ContentLength triggers when content is OUTSIDE the allowed range:
        // - exceeds max (too long → DLP violation)
        // - below min (too short → suspicious)
        // If neither min nor max is set, no match.
        RuleCondition::ContentLength { min, max } => {
            let len = content.len();
            let exceeds_max = max.is_some_and(|m| len > m);
            let below_min = min.is_some_and(|m| len < m);
            exceeds_max || below_min
        }
    }
}

/// Get a cached compiled regex, or compile and cache it.
fn get_or_compile_regex(pattern: &str, case_insensitive: bool) -> Result<Regex, String> {
    let key = (pattern.to_string(), case_insensitive);

    let mut cache = REGEX_CACHE.lock().unwrap();
    if let Some(result) = cache.get(&key) {
        return result.clone().map_err(|e| e.to_string());
    }

    let result = if case_insensitive {
        regex::RegexBuilder::new(pattern)
            .case_insensitive(true)
            .build()
    } else {
        Regex::new(pattern)
    };

    let cloned = match &result {
        Ok(re) => Ok(re.clone()),
        Err(e) => Err(e.to_string()),
    };
    cache.insert(key, cloned);

    result.map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keyword_match_any() {
        let condition = RuleCondition::Keyword {
            keywords: vec!["confidentiel".to_string(), "secret".to_string()],
            match_all: false,
        };
        assert!(matches_condition("Ce document est confidentiel", &condition));
        assert!(matches_condition("Données top secret", &condition));
        assert!(!matches_condition("Document public", &condition));
    }

    #[test]
    fn test_keyword_match_all() {
        let condition = RuleCondition::Keyword {
            keywords: vec!["cahier".to_string(), "charges".to_string()],
            match_all: true,
        };
        assert!(matches_condition("Génère un cahier des charges", &condition));
        assert!(!matches_condition("Un cahier de notes", &condition));
    }

    #[test]
    fn test_regex_match() {
        let condition = RuleCondition::Regex {
            pattern: r"\b\d{3}-\d{3}-\d{4}\b".to_string(),
            case_insensitive: false,
        };
        assert!(matches_condition("Appelle le 123-456-7890", &condition));
        assert!(!matches_condition("Pas de numéro ici", &condition));
    }

    #[test]
    fn test_regex_case_insensitive() {
        let condition = RuleCondition::Regex {
            pattern: r"\b(password|mot de passe)\b".to_string(),
            case_insensitive: true,
        };
        assert!(matches_condition("Mon PASSWORD est 123", &condition));
        assert!(matches_condition("Le mot de passe admin", &condition));
        assert!(!matches_condition("Rien de spécial ici", &condition));
    }

    #[test]
    fn test_regex_cache_reuse() {
        let condition = RuleCondition::Regex {
            pattern: r"\btest\b".to_string(),
            case_insensitive: false,
        };
        // Call twice — second call should use cached regex
        assert!(matches_condition("this is a test", &condition));
        assert!(matches_condition("another test here", &condition));
        assert!(!matches_condition("no match", &condition));
    }

    // ContentLength triggers when content is OUTSIDE the allowed range
    #[test]
    fn test_content_length_exceeds_max() {
        let condition = RuleCondition::ContentLength {
            min: None,
            max: Some(100),
        };
        let short = "court"; // 5 chars — within limit
        let long = "a".repeat(200); // 200 chars — exceeds max
        assert!(!matches_condition(short, &condition)); // within range → no match
        assert!(matches_condition(&long, &condition));  // exceeds max → MATCH
    }

    #[test]
    fn test_content_length_below_min() {
        let condition = RuleCondition::ContentLength {
            min: Some(50),
            max: None,
        };
        let short = "court"; // 5 chars — below min
        let long = "a".repeat(200); // 200 chars — above min
        assert!(matches_condition(short, &condition));  // below min → MATCH
        assert!(!matches_condition(&long, &condition)); // above min → no match
    }

    #[test]
    fn test_content_length_within_range_no_match() {
        let condition = RuleCondition::ContentLength {
            min: Some(10),
            max: Some(5000),
        };
        let medium = "a".repeat(500); // within [10, 5000]
        assert!(!matches_condition(&medium, &condition)); // within range → no match
    }

    #[test]
    fn test_content_length_outside_range_both_bounds() {
        let condition = RuleCondition::ContentLength {
            min: Some(100),
            max: Some(5000),
        };
        let short = "court"; // 5 chars < 100
        let long = "a".repeat(10000); // 10000 > 5000
        assert!(matches_condition(short, &condition));  // below min → MATCH
        assert!(matches_condition(&long, &condition));  // exceeds max → MATCH
    }

    #[test]
    fn test_content_length_no_bounds() {
        let condition = RuleCondition::ContentLength {
            min: None,
            max: None,
        };
        assert!(!matches_condition("anything", &condition)); // no bounds → never match
    }

    #[test]
    fn test_domain_list() {
        let condition = RuleCondition::DomainList {
            domains: vec!["openai.com".to_string(), "claude.ai".to_string()],
        };
        assert!(matches_condition("https://api.openai.com/v1/chat", &condition));
        assert!(matches_condition("https://claude.ai/chat", &condition));
        assert!(!matches_condition("https://google.com", &condition));
    }

    #[test]
    fn test_invalid_regex_returns_false() {
        let condition = RuleCondition::Regex {
            pattern: r"[invalid".to_string(),
            case_insensitive: false,
        };
        assert!(!matches_condition("anything", &condition));
    }
}
