use std::collections::HashMap;
use std::env;

use p256::ecdsa::SigningKey;
use p256::pkcs8::DecodePrivateKey;
use serde::Deserialize;

use crate::protocol::ApnsEnvironment;

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct RawKey {
    key_id: String,
    private_key_path: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RawKeys {
    development: Option<RawKey>,
    production: Option<RawKey>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct RawApp {
    id: String,
    bundle_id: String,
    team_id: String,
    key_id: Option<String>,
    private_key_path: Option<String>,
    keys: Option<RawKeys>,
}

#[derive(Clone)]
pub struct ApnsKey {
    pub key_id: String,
    pub signing_key: SigningKey,
}

pub struct ApnsApp {
    pub id: String,
    pub bundle_id: String,
    pub team_id: String,
    pub development: Option<ApnsKey>,
    pub production: Option<ApnsKey>,
}

impl ApnsApp {
    pub fn key(&self, environment: ApnsEnvironment) -> Option<&ApnsKey> {
        match environment {
            ApnsEnvironment::Development => self.development.as_ref(),
            ApnsEnvironment::Production => self.production.as_ref(),
        }
    }
}

pub struct Config {
    pub port: u16,
    pub public_url: String,
    pub database_url: String,
    pub data_key: String,
    pub apps: HashMap<String, ApnsApp>,
}

fn required(name: &str) -> Result<String, String> {
    env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| format!("{name} is required"))
}

fn non_empty(value: &str, name: &str) -> Result<(), String> {
    if value.is_empty() {
        Err(format!("{name} must not be empty"))
    } else {
        Ok(())
    }
}

fn load_key(raw: RawKey) -> Result<ApnsKey, String> {
    non_empty(&raw.key_id, "keyId")?;
    non_empty(&raw.private_key_path, "privateKeyPath")?;
    let pem = std::fs::read_to_string(&raw.private_key_path)
        .map_err(|e| format!("Cannot read APNs key {}: {e}", raw.private_key_path))?;
    let signing_key = SigningKey::from_pkcs8_pem(&pem)
        .map_err(|e| format!("Invalid APNs key {}: {e}", raw.private_key_path))?;
    Ok(ApnsKey {
        key_id: raw.key_id,
        signing_key,
    })
}

fn load_app(raw: RawApp) -> Result<ApnsApp, String> {
    if raw.id.is_empty() || raw.id.encode_utf16().count() > 64 {
        return Err("App id must be 1-64 characters".into());
    }
    if raw.bundle_id.encode_utf16().count() < 3 {
        return Err(format!(
            "App {} bundleId must be at least 3 characters",
            raw.id
        ));
    }
    non_empty(&raw.team_id, "teamId")?;

    let (development, production) = match (raw.keys, raw.key_id, raw.private_key_path) {
        (Some(_), Some(_), _) | (Some(_), _, Some(_)) => {
            return Err(format!(
                "App {}: use either keys or the legacy key fields, not both",
                raw.id
            ));
        }
        (Some(keys), None, None) => (
            keys.development.map(load_key).transpose()?,
            keys.production.map(load_key).transpose()?,
        ),
        (None, Some(key_id), Some(private_key_path)) => {
            let key = load_key(RawKey {
                key_id,
                private_key_path,
            })?;
            (Some(key.clone()), Some(key))
        }
        (None, Some(_), None) | (None, None, Some(_)) => {
            return Err(format!(
                "App {}: keyId and privateKeyPath must be configured together",
                raw.id
            ));
        }
        (None, None, None) => (None, None),
    };
    if development.is_none() && production.is_none() {
        return Err(format!(
            "App {}: at least one APNs environment key is required",
            raw.id
        ));
    }
    Ok(ApnsApp {
        id: raw.id,
        bundle_id: raw.bundle_id,
        team_id: raw.team_id,
        development,
        production,
    })
}

pub fn load() -> Result<Config, String> {
    let raw_apps: Vec<RawApp> = serde_json::from_str(&required("PUSH_RELAY_APPS_JSON")?)
        .map_err(|e| format!("PUSH_RELAY_APPS_JSON is invalid: {e}"))?;
    if raw_apps.is_empty() {
        return Err("PUSH_RELAY_APPS_JSON must configure at least one app".into());
    }
    let mut apps = HashMap::new();
    for raw in raw_apps {
        let app = load_app(raw)?;
        if apps.contains_key(&app.id) {
            return Err(format!("Duplicate Push Relay app id: {}", app.id));
        }
        apps.insert(app.id.clone(), app);
    }

    let public_url = url::Url::parse(&required("PUSH_RELAY_PUBLIC_URL")?)
        .map_err(|e| format!("PUSH_RELAY_PUBLIC_URL is invalid: {e}"))?;
    let host = public_url.host_str().unwrap_or_default();
    let is_local = matches!(host, "localhost" | "127.0.0.1" | "[::1]") || host.ends_with(".local");
    if public_url.scheme() != "https" && !is_local {
        return Err("PUSH_RELAY_PUBLIC_URL must use HTTPS outside localhost".into());
    }

    let port = match env::var("PUSH_RELAY_PORT") {
        Ok(value) => value.trim().parse::<u16>().ok().filter(|port| *port > 0),
        Err(_) => Some(8787),
    }
    .ok_or("PUSH_RELAY_PORT must be a valid TCP port")?;

    Ok(Config {
        port,
        public_url: public_url
            .as_str()
            .strip_suffix('/')
            .unwrap_or(public_url.as_str())
            .to_string(),
        database_url: required("PUSH_RELAY_DATABASE_URL")?,
        data_key: required("PUSH_RELAY_DATA_KEY")?,
        apps,
    })
}
