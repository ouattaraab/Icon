//! Certificate pinning for the Icon agent.
//!
//! Provides a custom `rustls::client::danger::ServerCertVerifier` implementation
//! that checks the SHA-256 hash of the server's end-entity certificate against
//! a pre-configured pin hash before delegating to standard webpki verification.

use std::sync::Arc;

use rustls::client::danger::ServerCertVerifier;
use rustls::crypto::{verify_tls12_signature, verify_tls13_signature, WebPkiSupportedAlgorithms};
use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use rustls::{
    CertificateError, ClientConfig, DigitallySignedStruct, Error, OtherError, RootCertStore,
    SignatureScheme,
};
use sha2::{Digest, Sha256};
use tracing::{debug, warn};

/// A `ServerCertVerifier` that enforces certificate pinning.
///
/// Before delegating to the inner webpki-based verifier for full chain
/// validation, this verifier computes the SHA-256 hash of the presented
/// end-entity certificate (DER bytes) and compares it to the expected
/// pin hash using constant-time comparison.
#[derive(Debug)]
pub struct PinnedCertVerifier {
    /// The expected SHA-256 hash of the server certificate (hex-encoded, lowercase).
    pin_hash: String,
    /// The inner webpki verifier for full chain validation.
    inner: Arc<rustls::client::WebPkiServerVerifier>,
    /// Supported signature verification algorithms from the crypto provider.
    supported_algs: WebPkiSupportedAlgorithms,
}

impl PinnedCertVerifier {
    /// Create a new `PinnedCertVerifier`.
    ///
    /// # Arguments
    /// * `pin_hash` - Hex-encoded SHA-256 hash of the expected server certificate DER bytes.
    /// * `inner` - The standard webpki server certificate verifier for chain validation.
    /// * `supported_algs` - The set of supported signature verification algorithms.
    pub fn new(
        pin_hash: String,
        inner: Arc<rustls::client::WebPkiServerVerifier>,
        supported_algs: WebPkiSupportedAlgorithms,
    ) -> Self {
        Self {
            pin_hash: pin_hash.to_lowercase(),
            inner,
            supported_algs,
        }
    }
}

impl ServerCertVerifier for PinnedCertVerifier {
    fn verify_server_cert(
        &self,
        end_entity: &CertificateDer<'_>,
        intermediates: &[CertificateDer<'_>],
        server_name: &ServerName<'_>,
        ocsp_response: &[u8],
        now: UnixTime,
    ) -> Result<rustls::client::danger::ServerCertVerified, Error> {
        // Compute SHA-256 hash of the presented certificate DER bytes.
        let cert_hash = hex::encode(Sha256::digest(end_entity.as_ref()));

        // Constant-time comparison of the hex-encoded hashes.
        if !constant_time_eq(cert_hash.as_bytes(), self.pin_hash.as_bytes()) {
            warn!(
                expected = %self.pin_hash,
                actual = %cert_hash,
                "Certificate pin mismatch — possible MITM attack"
            );
            return Err(Error::InvalidCertificate(CertificateError::Other(
                OtherError(Arc::new(CertPinMismatchError {
                    expected: self.pin_hash.clone(),
                    actual: cert_hash,
                })),
            )));
        }

        debug!("Certificate pin verified successfully");

        // Delegate to the inner webpki verifier for full chain validation
        // (expiry, trust anchor, server name, revocation, etc.).
        self.inner.verify_server_cert(
            end_entity,
            intermediates,
            server_name,
            ocsp_response,
            now,
        )
    }

    fn verify_tls12_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, Error> {
        verify_tls12_signature(message, cert, dss, &self.supported_algs)
    }

    fn verify_tls13_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, Error> {
        verify_tls13_signature(message, cert, dss, &self.supported_algs)
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.supported_algs.supported_schemes()
    }
}

/// Custom error type for certificate pin mismatches.
#[derive(Debug)]
struct CertPinMismatchError {
    expected: String,
    actual: String,
}

impl std::fmt::Display for CertPinMismatchError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "certificate pin mismatch: expected {}, got {}",
            self.expected, self.actual
        )
    }
}

impl std::error::Error for CertPinMismatchError {}

/// Create a `rustls::ClientConfig` with certificate pinning enabled.
///
/// The returned config uses webpki-roots for trust anchor verification and
/// additionally pins the server certificate to the provided SHA-256 hash.
///
/// # Arguments
/// * `pin_hash` - Hex-encoded SHA-256 hash of the expected server certificate.
pub fn create_pinned_tls_config(pin_hash: &str) -> ClientConfig {
    let provider = Arc::new(rustls::crypto::ring::default_provider());

    let root_store = Arc::new(RootCertStore::from_iter(
        webpki_roots::TLS_SERVER_ROOTS
            .iter()
            .cloned(),
    ));

    let webpki_verifier =
        rustls::client::WebPkiServerVerifier::builder_with_provider(root_store, provider.clone())
            .build()
            .expect("failed to build webpki server verifier");

    let supported_algs = provider.signature_verification_algorithms;

    let pinned_verifier = Arc::new(PinnedCertVerifier::new(
        pin_hash.to_string(),
        webpki_verifier,
        supported_algs,
    ));

    ClientConfig::builder_with_provider(provider)
        .with_safe_default_protocol_versions()
        .expect("failed to set default protocol versions")
        .dangerous()
        .with_custom_certificate_verifier(pinned_verifier)
        .with_no_client_auth()
}

/// Create a default `rustls::ClientConfig` without certificate pinning.
///
/// Uses webpki-roots for trust anchor verification with standard settings.
pub fn create_default_tls_config() -> ClientConfig {
    let provider = Arc::new(rustls::crypto::ring::default_provider());

    let root_store = RootCertStore::from_iter(
        webpki_roots::TLS_SERVER_ROOTS
            .iter()
            .cloned(),
    );

    ClientConfig::builder_with_provider(provider)
        .with_safe_default_protocol_versions()
        .expect("failed to set default protocol versions")
        .with_root_certificates(root_store)
        .with_no_client_auth()
}

/// Constant-time comparison of two byte slices.
///
/// Returns `true` if and only if both slices have the same length and content.
/// The comparison always examines all bytes to avoid timing side channels.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }

    let mut diff: u8 = 0;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }

    diff == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constant_time_eq_same() {
        assert!(constant_time_eq(b"abc123", b"abc123"));
    }

    #[test]
    fn test_constant_time_eq_different() {
        assert!(!constant_time_eq(b"abc123", b"abc124"));
    }

    #[test]
    fn test_constant_time_eq_different_lengths() {
        assert!(!constant_time_eq(b"abc", b"abcd"));
    }

    #[test]
    fn test_constant_time_eq_empty() {
        assert!(constant_time_eq(b"", b""));
    }

    #[test]
    fn test_create_default_tls_config() {
        // Should not panic
        let _config = create_default_tls_config();
    }

    #[test]
    fn test_create_pinned_tls_config() {
        // Should not panic even with a dummy hash
        let dummy_hash = "a".repeat(64);
        let _config = create_pinned_tls_config(&dummy_hash);
    }

    #[test]
    fn test_pin_hash_is_lowercased() {
        let upper = "ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789";
        let lower = upper.to_lowercase();

        let provider = Arc::new(rustls::crypto::ring::default_provider());
        let root_store = Arc::new(RootCertStore::from_iter(
            webpki_roots::TLS_SERVER_ROOTS.iter().cloned(),
        ));
        let webpki_verifier =
            rustls::client::WebPkiServerVerifier::builder_with_provider(
                root_store,
                provider.clone(),
            )
            .build()
            .unwrap();

        let verifier = PinnedCertVerifier::new(
            upper.to_string(),
            webpki_verifier,
            provider.signature_verification_algorithms,
        );

        assert_eq!(verifier.pin_hash, lower);
    }
}
