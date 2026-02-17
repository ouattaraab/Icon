use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    pub id: String,
    pub name: String,
    pub version: u64,
    pub category: RuleCategory,
    pub target: RuleTarget,
    pub condition: RuleCondition,
    pub action: RuleAction,
    pub priority: u32,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RuleCategory {
    Block,
    Alert,
    Log,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RuleTarget {
    Prompt,
    Response,
    Clipboard,
    Domain,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum RuleCondition {
    Regex {
        pattern: String,
        #[serde(default)]
        case_insensitive: bool,
    },
    Keyword {
        keywords: Vec<String>,
        #[serde(default)]
        match_all: bool,
    },
    DomainList {
        domains: Vec<String>,
    },
    ContentLength {
        min: Option<usize>,
        max: Option<usize>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum RuleAction {
    Block {
        message: String,
    },
    Alert {
        severity: AlertSeverity,
    },
    Log,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AlertSeverity {
    Info,
    Warning,
    Critical,
}

/// Résultat de l'évaluation d'un contenu par le rule engine
#[derive(Debug, Clone)]
pub enum EvaluationResult {
    /// Contenu bloqué avec message d'avertissement
    Blocked {
        rule_id: String,
        rule_name: String,
        message: String,
    },
    /// Alerte générée mais contenu autorisé
    Alerted {
        rule_id: String,
        rule_name: String,
        severity: AlertSeverity,
    },
    /// Contenu loggé (pas d'action spéciale)
    Logged {
        rule_id: Option<String>,
    },
    /// Aucune règle ne matche
    NoMatch,
}
