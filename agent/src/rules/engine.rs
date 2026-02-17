use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, debug};

use crate::rules::matcher;
use crate::rules::models::*;
use crate::storage::database::Database;

pub struct RuleEngine {
    db: Arc<Database>,
    /// Rules cached in memory, sorted by priority (descending)
    cached_rules: RwLock<Vec<Rule>>,
}

impl RuleEngine {
    pub fn new(db: Arc<Database>) -> Self {
        Self {
            db,
            cached_rules: RwLock::new(Vec::new()),
        }
    }

    /// Load rules from local SQLite into memory cache
    pub async fn load_rules(&self) -> anyhow::Result<()> {
        let rules = self.db.get_all_rules()?;
        let count = rules.len();
        let mut cache = self.cached_rules.write().await;
        *cache = rules;
        cache.sort_by(|a, b| b.priority.cmp(&a.priority));
        info!(count, "Rules loaded into cache");
        Ok(())
    }

    /// Save rules from server to local DB and refresh cache
    pub async fn update_rules(&self, rules: Vec<Rule>) -> anyhow::Result<()> {
        for rule in &rules {
            self.db.upsert_rule(rule)?;
        }
        self.load_rules().await
    }

    /// Delete a rule by ID
    pub async fn delete_rule(&self, rule_id: &str) -> anyhow::Result<()> {
        self.db.delete_rule(rule_id)?;
        self.load_rules().await
    }

    /// Get the latest rule version number (for incremental sync)
    pub async fn latest_version(&self) -> u64 {
        let cache = self.cached_rules.read().await;
        cache.iter().map(|r| r.version).max().unwrap_or(0)
    }

    /// Evaluate content against all rules for a given target type.
    /// Returns the result of the first matching rule (highest priority).
    pub async fn evaluate(&self, content: &str, target: RuleTarget) -> EvaluationResult {
        let rules = self.cached_rules.read().await;

        for rule in rules.iter() {
            if !rule.enabled {
                continue;
            }

            if rule.target != target {
                continue;
            }

            if matcher::matches_condition(content, &rule.condition) {
                debug!(rule_id = %rule.id, rule_name = %rule.name, "Rule matched");

                return match &rule.action {
                    RuleAction::Block { message } => EvaluationResult::Blocked {
                        rule_id: rule.id.clone(),
                        rule_name: rule.name.clone(),
                        message: message.clone(),
                    },
                    RuleAction::Alert { severity } => EvaluationResult::Alerted {
                        rule_id: rule.id.clone(),
                        rule_name: rule.name.clone(),
                        severity: severity.clone(),
                    },
                    RuleAction::Log => EvaluationResult::Logged {
                        rule_id: Some(rule.id.clone()),
                    },
                };
            }
        }

        EvaluationResult::NoMatch
    }
}
