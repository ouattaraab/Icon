use serde::Deserialize;
use std::path::PathBuf;

#[derive(Debug, Clone, Deserialize)]
pub struct AppConfig {
    /// URL du serveur Icon central
    pub server_url: String,

    /// Clé API machine (générée à l'enregistrement)
    pub api_key: Option<String>,

    /// Machine ID (attribué par le serveur)
    pub machine_id: Option<String>,

    /// Répertoire de stockage local
    pub data_dir: PathBuf,

    /// Clé de chiffrement de la BDD locale (SQLCipher)
    pub db_encryption_key: String,

    /// Port du proxy local
    pub proxy_port: u16,

    /// Intervalle heartbeat en secondes
    pub heartbeat_interval_secs: u64,

    /// Intervalle sync événements en secondes
    pub event_sync_interval_secs: u64,

    /// Taille max du batch d'événements
    pub event_batch_size: usize,

    /// Rétention locale max en jours
    pub local_retention_days: u32,

    /// Hash SHA-256 du certificat serveur (certificate pinning)
    pub server_cert_pin: Option<String>,

    /// Clé HMAC pour la signature des requêtes
    pub hmac_secret: Option<String>,

    /// URL WebSocket du serveur
    pub websocket_url: String,
}

impl AppConfig {
    pub fn load() -> anyhow::Result<Self> {
        let config_path = Self::config_path();

        let settings = config::Config::builder()
            // Defaults
            .set_default("server_url", "https://icon.gs2e.ci")?
            .set_default("proxy_port", 8443_i64)?
            .set_default("heartbeat_interval_secs", 60_i64)?
            .set_default("event_sync_interval_secs", 30_i64)?
            .set_default("event_batch_size", 100_i64)?
            .set_default("local_retention_days", 7_i64)?
            .set_default("websocket_url", "wss://icon.gs2e.ci/ws")?
            .set_default("data_dir", Self::default_data_dir().to_string_lossy().to_string())?
            .set_default("db_encryption_key", "CHANGE_ME_ON_INSTALL")?
            // Config file
            .add_source(config::File::from(config_path).required(false))
            // Environment variables (prefixed ICON_)
            .add_source(config::Environment::with_prefix("ICON"))
            .build()?;

        let config: AppConfig = settings.try_deserialize()?;
        Ok(config)
    }

    fn config_path() -> PathBuf {
        if cfg!(target_os = "windows") {
            PathBuf::from(r"C:\ProgramData\Icon\config.toml")
        } else {
            PathBuf::from("/etc/icon/config.toml")
        }
    }

    fn default_data_dir() -> PathBuf {
        if cfg!(target_os = "windows") {
            PathBuf::from(r"C:\ProgramData\Icon\data")
        } else {
            PathBuf::from("/var/lib/icon")
        }
    }
}
