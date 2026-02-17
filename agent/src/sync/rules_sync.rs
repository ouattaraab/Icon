use std::sync::Arc;
use tracing::{info, error};

use crate::rules::engine::RuleEngine;
use crate::sync::api_client::ApiClient;

/// Sync rules from the server (incremental)
pub async fn sync_rules(
    api_client: &Arc<ApiClient>,
    rule_engine: &Arc<RuleEngine>,
) -> anyhow::Result<()> {
    let current_version = rule_engine.latest_version().await;
    info!(since_version = current_version, "Syncing rules from server");

    let response = api_client.sync_rules(current_version).await?;

    // Apply new/updated rules
    if !response.rules.is_empty() {
        info!(count = response.rules.len(), "Applying new/updated rules");
        rule_engine.update_rules(response.rules).await?;
    }

    // Delete removed rules
    for rule_id in &response.deleted_ids {
        rule_engine.delete_rule(rule_id).await?;
    }

    info!("Rule sync complete");
    Ok(())
}
