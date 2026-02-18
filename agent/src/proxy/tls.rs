use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use lru::LruCache;
use rcgen::{BasicConstraints, CertificateParams, DistinguishedName, IsCa, KeyPair};
use rustls::pki_types::{CertificateDer, PrivateKeyDer, ServerName};
use rustls::{ClientConfig, ServerConfig};
use tokio::sync::Mutex;
use tracing::{debug, info};

/// Max number of domain certificates to keep in the LRU cache
const CERT_CACHE_SIZE: usize = 256;

/// Manages the local CA certificate and per-domain cert generation for MITM
#[allow(dead_code)] // pub API fields/methods used by installers and system setup
pub struct CaManager {
    ca_cert_pem: String,
    ca_key_pem: String,
    cert_path: PathBuf,
    #[allow(dead_code)] // Stored for future key export/rotation operations
    key_path: PathBuf,
    /// LRU cache: domain -> (ServerConfig ready for TLS accept)
    server_config_cache: Mutex<LruCache<String, Arc<ServerConfig>>>,
    /// Shared TLS client config for connecting to upstream servers
    upstream_tls_config: Arc<ClientConfig>,
}

impl CaManager {
    /// Load existing CA or generate a new one, initialize TLS configs
    pub fn load_or_create(data_dir: &Path) -> anyhow::Result<Arc<Self>> {
        let cert_path = data_dir.join("icon-ca.crt");
        let key_path = data_dir.join("icon-ca.key");

        let (ca_cert_pem, ca_key_pem) = if cert_path.exists() && key_path.exists() {
            info!("Loading existing CA certificate");
            (
                std::fs::read_to_string(&cert_path)?,
                std::fs::read_to_string(&key_path)?,
            )
        } else {
            info!("Generating new CA certificate");
            let (cert, key) = Self::generate_ca()?;
            std::fs::create_dir_all(data_dir)?;
            std::fs::write(&cert_path, &cert)?;
            std::fs::write(&key_path, &key)?;

            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                std::fs::set_permissions(&key_path, std::fs::Permissions::from_mode(0o600))?;
            }
            (cert, key)
        };

        // Build a client TLS config that trusts the standard webpki roots
        // (used to connect to upstream AI servers)
        let mut root_store = rustls::RootCertStore::empty();
        root_store.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());

        let upstream_tls_config = Arc::new(
            ClientConfig::builder()
                .with_root_certificates(root_store)
                .with_no_client_auth(),
        );

        Ok(Arc::new(Self {
            ca_cert_pem,
            ca_key_pem,
            cert_path,
            key_path,
            server_config_cache: Mutex::new(LruCache::new(
                std::num::NonZeroUsize::new(CERT_CACHE_SIZE).unwrap(),
            )),
            upstream_tls_config,
        }))
    }

    fn generate_ca() -> anyhow::Result<(String, String)> {
        let key_pair = KeyPair::generate()?;

        let mut params = CertificateParams::default();
        let mut dn = DistinguishedName::new();
        dn.push(rcgen::DnType::CommonName, "Icon Security CA");
        dn.push(rcgen::DnType::OrganizationName, "GS2E");
        dn.push(rcgen::DnType::CountryName, "CI");
        params.distinguished_name = dn;
        params.is_ca = IsCa::Ca(BasicConstraints::Unconstrained);
        params.not_before = rcgen::date_time_ymd(2024, 1, 1);
        params.not_after = rcgen::date_time_ymd(2034, 1, 1);

        let cert = params.self_signed(&key_pair)?;
        Ok((cert.pem(), key_pair.serialize_pem()))
    }

    /// Get (or create and cache) a rustls ServerConfig for the given domain.
    /// The returned config contains a certificate chain signed by our local CA.
    pub async fn get_server_config(&self, domain: &str) -> anyhow::Result<Arc<ServerConfig>> {
        // Check cache first
        {
            let mut cache = self.server_config_cache.lock().await;
            if let Some(cfg) = cache.get(domain) {
                return Ok(cfg.clone());
            }
        }

        debug!(domain, "Generating TLS certificate for domain");

        // Generate a new cert/key for this domain
        let (cert_pem, key_pem) = self.generate_domain_cert(domain)?;

        // Parse into rustls types
        let certs = Self::parse_certs_pem(&cert_pem)?;
        let key = Self::parse_key_pem(&key_pem)?;

        let server_config = Arc::new(
            ServerConfig::builder()
                .with_no_client_auth()
                .with_single_cert(certs, key)?,
        );

        // Store in cache
        {
            let mut cache = self.server_config_cache.lock().await;
            cache.put(domain.to_string(), server_config.clone());
        }

        Ok(server_config)
    }

    /// Generate a certificate for a specific domain, signed by this CA
    fn generate_domain_cert(&self, domain: &str) -> anyhow::Result<(String, String)> {
        let ca_key = KeyPair::from_pem(&self.ca_key_pem)?;

        // Re-create CA params to sign domain certs
        let mut ca_params = CertificateParams::default();
        let mut ca_dn = DistinguishedName::new();
        ca_dn.push(rcgen::DnType::CommonName, "Icon Security CA");
        ca_dn.push(rcgen::DnType::OrganizationName, "GS2E");
        ca_dn.push(rcgen::DnType::CountryName, "CI");
        ca_params.distinguished_name = ca_dn;
        ca_params.is_ca = IsCa::Ca(BasicConstraints::Unconstrained);
        let ca_cert = ca_params.self_signed(&ca_key)?;

        let domain_key = KeyPair::generate()?;
        let mut domain_params = CertificateParams::new(vec![domain.to_string()])?;
        let mut dn = DistinguishedName::new();
        dn.push(rcgen::DnType::CommonName, domain);
        dn.push(rcgen::DnType::OrganizationName, "GS2E");
        domain_params.distinguished_name = dn;

        let domain_cert = domain_params.signed_by(&domain_key, &ca_cert, &ca_key)?;

        Ok((domain_cert.pem(), domain_key.serialize_pem()))
    }

    /// Build a tokio-rustls TlsAcceptor for the client-side handshake
    pub async fn make_tls_acceptor(
        &self,
        domain: &str,
    ) -> anyhow::Result<tokio_rustls::TlsAcceptor> {
        let config = self.get_server_config(domain).await?;
        Ok(tokio_rustls::TlsAcceptor::from(config))
    }

    /// Build a tokio-rustls TlsConnector for the upstream-side handshake
    pub fn make_tls_connector(&self) -> tokio_rustls::TlsConnector {
        tokio_rustls::TlsConnector::from(self.upstream_tls_config.clone())
    }

    /// Convert a domain string to a rustls ServerName
    pub fn server_name(domain: &str) -> anyhow::Result<ServerName<'static>> {
        let name = ServerName::try_from(domain.to_string())
            .map_err(|_| anyhow::anyhow!("Invalid DNS name: {}", domain))?;
        Ok(name)
    }

    // --- PEM parsing helpers ---

    fn parse_certs_pem(pem: &str) -> anyhow::Result<Vec<CertificateDer<'static>>> {
        let mut reader = BufReader::new(pem.as_bytes());
        let certs: Vec<CertificateDer<'static>> = rustls_pemfile::certs(&mut reader)
            .filter_map(|r| r.ok())
            .collect();
        if certs.is_empty() {
            anyhow::bail!("No certificates found in PEM");
        }
        Ok(certs)
    }

    fn parse_key_pem(pem: &str) -> anyhow::Result<PrivateKeyDer<'static>> {
        let mut reader = BufReader::new(pem.as_bytes());
        let key = rustls_pemfile::pkcs8_private_keys(&mut reader)
            .next()
            .ok_or_else(|| anyhow::anyhow!("No private key found in PEM"))??;
        Ok(PrivateKeyDer::Pkcs8(key))
    }

    /// Public accessor for CA cert path, used by install scripts and CLI tooling
    #[allow(dead_code)]
    pub fn cert_path(&self) -> &Path {
        &self.cert_path
    }

    /// Public accessor for CA PEM, used during trust store setup
    #[allow(dead_code)]
    pub fn ca_cert_pem(&self) -> &str {
        &self.ca_cert_pem
    }

    /// Install the CA certificate in the system trust store.
    /// Called during first-boot setup to ensure the OS trusts our MITM CA.
    pub fn install_in_trust_store(&self) -> anyhow::Result<()> {
        let cert_path_str = self.cert_path.to_string_lossy();

        if cfg!(target_os = "windows") {
            std::process::Command::new("certutil")
                .args(["-addstore", "Root", &cert_path_str])
                .output()?;
        } else if cfg!(target_os = "macos") {
            std::process::Command::new("security")
                .args([
                    "add-trusted-cert",
                    "-d",
                    "-r",
                    "trustRoot",
                    "-k",
                    "/Library/Keychains/System.keychain",
                    &cert_path_str,
                ])
                .output()?;
        }

        info!("CA certificate installed in system trust store");
        Ok(())
    }
}
