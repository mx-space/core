use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use base64::Engine;
use base64::alphabet;
use base64::engine::general_purpose::{GeneralPurpose, GeneralPurposeConfig};
use base64::engine::{DecodePaddingMode, general_purpose::URL_SAFE_NO_PAD};
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;

const ENVELOPE_VERSION: &str = "v1";
const TAG_LEN: usize = 16;

const LENIENT_URL_SAFE: GeneralPurpose = GeneralPurpose::new(
    &alphabet::URL_SAFE,
    GeneralPurposeConfig::new().with_decode_padding_mode(DecodePaddingMode::Indifferent),
);
const LENIENT_STANDARD: GeneralPurpose = GeneralPurpose::new(
    &alphabet::STANDARD,
    GeneralPurposeConfig::new().with_decode_padding_mode(DecodePaddingMode::Indifferent),
);

pub fn base64url(bytes: &[u8]) -> String {
    URL_SAFE_NO_PAD.encode(bytes)
}

pub fn sha256_hex(value: &[u8]) -> String {
    hex::encode(Sha256::digest(value))
}

pub fn random_credential(prefix: &str) -> String {
    format!("{prefix}_{}", base64url(&rand::random::<[u8; 32]>()))
}

pub fn credential_hash(value: &str) -> String {
    sha256_hex(value.as_bytes())
}

pub fn credentials_match(plain: &str, expected_hash: &str) -> bool {
    let actual = Sha256::digest(plain.as_bytes());
    match hex::decode(expected_hash) {
        Ok(expected) => bool::from(actual.as_slice().ct_eq(expected.as_slice())),
        Err(_) => false,
    }
}

pub fn sign_push_request(
    secret: &str,
    timestamp: &str,
    delivery_id: &str,
    raw_body: &[u8],
) -> String {
    let canonical = format!("v1\n{timestamp}\n{delivery_id}\n{}", sha256_hex(raw_body));
    let mut mac =
        Hmac::<Sha256>::new_from_slice(secret.as_bytes()).expect("HMAC accepts any key length");
    mac.update(canonical.as_bytes());
    format!("v1={}", hex::encode(mac.finalize().into_bytes()))
}

pub fn verify_push_request_signature(
    secret: &str,
    timestamp: &str,
    delivery_id: &str,
    raw_body: &[u8],
    signature: &str,
) -> bool {
    let expected = sign_push_request(secret, timestamp, delivery_id, raw_body);
    expected.len() == signature.len() && bool::from(expected.as_bytes().ct_eq(signature.as_bytes()))
}

pub fn is_push_timestamp_fresh(value: &str, now_ms: i64) -> bool {
    const MAX_SKEW_MS: i64 = 5 * 60 * 1000;
    const MAX_SAFE_INTEGER: i64 = (1 << 53) - 1;
    if !(10..=16).contains(&value.len()) || !value.bytes().all(|b| b.is_ascii_digit()) {
        return false;
    }
    match value.parse::<i64>() {
        Ok(parsed) if parsed <= MAX_SAFE_INTEGER => (now_ms - parsed).abs() <= MAX_SKEW_MS,
        _ => false,
    }
}

fn parse_data_key(value: &str) -> Result<[u8; 32], String> {
    let decoded = if value.len() == 64 && value.bytes().all(|b| b.is_ascii_hexdigit()) {
        hex::decode(value).map_err(|e| e.to_string())?
    } else {
        // Node's base64 decoder also accepts the URL-safe alphabet and ignores padding.
        let normalized: String = value
            .chars()
            .filter(|c| !c.is_whitespace())
            .map(|c| match c {
                '-' => '+',
                '_' => '/',
                c => c,
            })
            .collect();
        LENIENT_STANDARD.decode(normalized).unwrap_or_default()
    };
    decoded
        .try_into()
        .map_err(|_| "PUSH_RELAY_DATA_KEY must decode to exactly 32 bytes".to_string())
}

pub struct DataVault {
    cipher: Aes256Gcm,
}

impl DataVault {
    pub fn new(key: &str) -> Result<Self, String> {
        let key = parse_data_key(key)?;
        Ok(Self {
            cipher: Aes256Gcm::new(&Key::<Aes256Gcm>::from(key)),
        })
    }

    pub fn encrypt(&self, value: &str) -> String {
        let nonce_bytes = rand::random::<[u8; 12]>();
        let sealed = self
            .cipher
            .encrypt(&Nonce::from(nonce_bytes), value.as_bytes())
            .expect("AES-GCM encryption does not fail for in-memory input");
        let (ciphertext, tag) = sealed.split_at(sealed.len() - TAG_LEN);
        [
            ENVELOPE_VERSION.to_string(),
            base64url(&nonce_bytes),
            base64url(tag),
            base64url(ciphertext),
        ]
        .join(".")
    }

    pub fn decrypt(&self, envelope: &str) -> Result<String, String> {
        let unsupported = || "Unsupported encrypted data envelope".to_string();
        let mut parts = envelope.split('.');
        let (Some(version), Some(nonce), Some(tag), Some(ciphertext)) =
            (parts.next(), parts.next(), parts.next(), parts.next())
        else {
            return Err(unsupported());
        };
        if version != ENVELOPE_VERSION
            || nonce.is_empty()
            || tag.is_empty()
            || ciphertext.is_empty()
        {
            return Err(unsupported());
        }
        let decode = |v: &str| LENIENT_URL_SAFE.decode(v).map_err(|_| unsupported());
        let nonce = Nonce::try_from(decode(nonce)?.as_slice()).map_err(|_| unsupported())?;
        let mut sealed = decode(ciphertext)?;
        sealed.extend_from_slice(&decode(tag)?);
        let plain = self
            .cipher
            .decrypt(&nonce, sealed.as_slice())
            .map_err(|_| "Unsupported state or unable to authenticate data".to_string())?;
        String::from_utf8(plain).map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const KEY: &str = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";

    #[test]
    fn vault_round_trips() {
        let vault = DataVault::new(KEY).unwrap();
        let envelope = vault.encrypt("hello");
        assert!(envelope.starts_with("v1."));
        assert_eq!(vault.decrypt(&envelope).unwrap(), "hello");
    }

    #[test]
    fn vault_decrypts_node_envelope() {
        let vault = DataVault::new(KEY).unwrap();
        assert_eq!(
            vault
                .decrypt(include_str!("../test/node-envelope.txt").trim())
                .unwrap(),
            "hello from node"
        );
    }

    #[test]
    fn data_key_accepts_hex_and_base64() {
        assert!(DataVault::new(KEY).is_ok());
        assert!(DataVault::new("AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=").is_ok());
        assert!(DataVault::new("short").is_err());
    }

    #[test]
    fn signature_matches_node() {
        let signature = sign_push_request("secret", "1700000000000", "dlv_1", b"{\"a\":1}");
        assert_eq!(signature, include_str!("../test/node-signature.txt").trim());
        assert!(verify_push_request_signature(
            "secret",
            "1700000000000",
            "dlv_1",
            b"{\"a\":1}",
            &signature
        ));
        assert!(!verify_push_request_signature(
            "secret",
            "1700000000000",
            "dlv_2",
            b"{\"a\":1}",
            &signature
        ));
    }

    #[test]
    fn credentials_compare_by_hash() {
        let hash = credential_hash("abc");
        assert!(credentials_match("abc", &hash));
        assert!(!credentials_match("abd", &hash));
    }

    #[test]
    fn timestamp_freshness() {
        let now = 1_700_000_000_000;
        assert!(is_push_timestamp_fresh("1700000000000", now));
        assert!(!is_push_timestamp_fresh("1699999000000", now));
        assert!(!is_push_timestamp_fresh("abc", now));
        assert!(!is_push_timestamp_fresh("9999999999999999", now));
    }
}
