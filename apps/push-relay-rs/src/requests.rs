use serde::Deserialize;
use serde_json::Value;

use crate::protocol::{ApnsEnvironment, Issue, PushPreferences};
use crate::validate::{Checker, decode, is_url};

fn is_apns_token(value: &str) -> bool {
    value.len() >= 64 && value.bytes().all(|b| b.is_ascii_hexdigit())
}

#[derive(Deserialize, Debug)]
#[serde(deny_unknown_fields)]
pub struct RegisterInstallation {
    pub app_id: String,
    pub apns_environment: ApnsEnvironment,
    pub apns_token: String,
}

impl RegisterInstallation {
    pub fn parse(value: Value) -> Result<Self, Vec<Issue>> {
        let parsed: Self = decode(value)?;
        let mut checker = Checker::default();
        checker.len(&["app_id"], &parsed.app_id, 1, 64);
        checker.check(
            is_apns_token(&parsed.apns_token),
            &["apns_token"],
            "Invalid string: must match pattern",
        );
        checker.finish(parsed)
    }
}

#[derive(Deserialize, Debug)]
#[serde(deny_unknown_fields)]
pub struct UpdateInstallationToken {
    pub apns_environment: ApnsEnvironment,
    pub apns_token: String,
}

impl UpdateInstallationToken {
    pub fn parse(value: Value) -> Result<Self, Vec<Issue>> {
        let parsed: Self = decode(value)?;
        let mut checker = Checker::default();
        checker.check(
            is_apns_token(&parsed.apns_token),
            &["apns_token"],
            "Invalid string: must match pattern",
        );
        checker.finish(parsed)
    }
}

#[derive(Deserialize, Debug)]
#[serde(deny_unknown_fields)]
pub struct ClaimSourceActivation {
    pub ticket: String,
    pub source_origin: String,
    pub source_label: Option<String>,
    pub reader_id: Option<String>,
    pub preferences: Option<PushPreferences>,
}

impl ClaimSourceActivation {
    pub fn parse(value: Value) -> Result<Self, Vec<Issue>> {
        let mut parsed: Self = decode(value)?;
        let mut checker = Checker::default();
        checker.len(&["ticket"], &parsed.ticket, 32, 256);
        checker.check(
            is_url(&parsed.source_origin),
            &["source_origin"],
            "Invalid URL",
        );
        checker.len(&["source_origin"], &parsed.source_origin, 0, 2048);
        checker.trimmed_opt(&["source_label"], &mut parsed.source_label, 1, 128);
        if let Some(reader_id) = &parsed.reader_id {
            checker.len(&["reader_id"], reader_id, 1, 128);
        }
        checker.finish(parsed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn register_installation_validation() {
        let ok = json!({ "app_id": "space", "apns_environment": "development", "apns_token": "ab".repeat(32) });
        assert!(RegisterInstallation::parse(ok).is_ok());
        let bad = json!({ "app_id": "space", "apns_environment": "staging", "apns_token": "ab" });
        assert!(RegisterInstallation::parse(bad).is_err());
    }
}
