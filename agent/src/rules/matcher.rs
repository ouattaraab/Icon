use regex::Regex;
use crate::rules::models::RuleCondition;

/// Évalue si un contenu matche une condition de règle
pub fn matches_condition(content: &str, condition: &RuleCondition) -> bool {
    match condition {
        RuleCondition::Regex { pattern, case_insensitive } => {
            match build_regex(pattern, *case_insensitive) {
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

        RuleCondition::ContentLength { min, max } => {
            let len = content.len();
            let above_min = min.map_or(true, |m| len >= m);
            let below_max = max.map_or(true, |m| len <= m);
            above_min && below_max
        }
    }
}

fn build_regex(pattern: &str, case_insensitive: bool) -> Result<Regex, regex::Error> {
    if case_insensitive {
        regex::RegexBuilder::new(pattern)
            .case_insensitive(true)
            .build()
    } else {
        Regex::new(pattern)
    }
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
    fn test_content_length() {
        let condition = RuleCondition::ContentLength {
            min: Some(100),
            max: Some(5000),
        };
        let short = "court";
        let medium = "a".repeat(500);
        let long = "a".repeat(10000);
        assert!(!matches_condition(short, &condition));
        assert!(matches_condition(&medium, &condition));
        assert!(!matches_condition(&long, &condition));
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
}
