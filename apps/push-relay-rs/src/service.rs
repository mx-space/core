use std::collections::HashSet;

use chrono::{SecondsFormat, TimeDelta, Utc};
use serde_json::{Value, json};

use crate::crypto::{
    DataVault, credential_hash, credentials_match, is_push_timestamp_fresh, random_credential,
    verify_push_request_signature,
};
use crate::protocol::{Issue, PushEvent, PushPreferences, SOURCE_URN_PREFIX};
use crate::requests::{ClaimSourceActivation, RegisterInstallation, UpdateInstallationToken};
use crate::store::{DbError, InstallationRecord, NewBinding, NewInstallation, SourceRecord, Store};
use crate::validate::decode;

pub enum RelayError {
    Http {
        status: u16,
        code: &'static str,
        message: &'static str,
    },
    Validation(Vec<Issue>),
    Internal(String),
}

impl From<DbError> for RelayError {
    fn from(error: DbError) -> Self {
        if error.0.contains("relay_admission_limited") {
            http(
                429,
                "relay_admission_limited",
                "Relay registration or delivery budget exceeded",
            )
        } else {
            Self::Internal(error.0)
        }
    }
}

impl From<Vec<Issue>> for RelayError {
    fn from(issues: Vec<Issue>) -> Self {
        Self::Validation(issues)
    }
}

fn http(status: u16, code: &'static str, message: &'static str) -> RelayError {
    RelayError::Http {
        status,
        code,
        message,
    }
}

type Result<T> = std::result::Result<T, RelayError>;

fn parse_authorization<'a>(value: Option<&'a str>, scheme: &str) -> Option<(&'a str, &'a str)> {
    let credential = value?.strip_prefix(scheme)?.strip_prefix(' ')?;
    let separator = credential.find('.').filter(|index| *index >= 1)?;
    Some((&credential[..separator], &credential[separator + 1..]))
}

fn new_id(prefix: &str) -> String {
    format!("{prefix}_{}", uuid::Uuid::new_v4())
}

pub struct WebhookRequest<'a> {
    pub raw_body: &'a [u8],
    pub source_id: Option<&'a str>,
    pub delivery_id: Option<&'a str>,
    pub timestamp: Option<&'a str>,
    pub signature: Option<&'a str>,
}

pub struct RelayService {
    store: Store,
    vault: DataVault,
    public_url: String,
    app_ids: HashSet<String>,
    enrollment_token_hash: Option<String>,
}

impl RelayService {
    pub fn new(
        store: Store,
        vault: DataVault,
        public_url: String,
        app_ids: HashSet<String>,
        enrollment_token: Option<String>,
    ) -> Self {
        Self {
            store,
            vault,
            public_url,
            app_ids,
            enrollment_token_hash: enrollment_token.map(|token| credential_hash(&token)),
        }
    }

    fn encrypt_token(&self, token: &str) -> (String, String) {
        let token = token.to_lowercase();
        (credential_hash(&token), self.vault.encrypt(&token))
    }

    fn decrypt(&self, envelope: &str) -> Result<String> {
        self.vault.decrypt(envelope).map_err(RelayError::Internal)
    }

    pub async fn register_installation(&self, input: Value) -> Result<Value> {
        let parsed = RegisterInstallation::parse(input)?;
        if !self.app_ids.contains(&parsed.app_id) {
            return Err(http(
                422,
                "unknown_app",
                "The app is not configured by this relay",
            ));
        }
        let installation_id = new_id("ins");
        let installation_secret = random_credential("inssec");
        let (token_hash, token_ciphertext) = self.encrypt_token(&parsed.apns_token);
        self.store
            .create_installation(NewInstallation {
                id: &installation_id,
                app_id: &parsed.app_id,
                apns_environment: parsed.apns_environment,
                token_hash: &token_hash,
                token_ciphertext: &token_ciphertext,
                secret_hash: &credential_hash(&installation_secret),
            })
            .await?;
        Ok(
            json!({ "installation_id": installation_id, "installation_secret": installation_secret }),
        )
    }

    pub async fn update_installation_token(
        &self,
        installation_id: &str,
        authorization: Option<&str>,
        input: Value,
    ) -> Result<Value> {
        let principal = self.authenticate_installation(authorization).await?;
        if principal.id != installation_id {
            return Err(http(
                403,
                "installation_mismatch",
                "Installation credential does not match the requested installation",
            ));
        }
        let parsed = UpdateInstallationToken::parse(input)?;
        let (token_hash, token_ciphertext) = self.encrypt_token(&parsed.apns_token);
        let updated = self
            .store
            .update_installation_token(
                &principal.id,
                parsed.apns_environment,
                &token_hash,
                &token_ciphertext,
            )
            .await?;
        if !updated {
            return Err(http(
                404,
                "installation_not_found",
                "Installation not found",
            ));
        }
        Ok(json!({ "updated": true }))
    }

    pub async fn create_activation_ticket(&self, authorization: Option<&str>) -> Result<Value> {
        let installation = self.authenticate_installation(authorization).await?;
        let ticket = random_credential("act");
        let expires_at = Utc::now() + TimeDelta::minutes(10);
        self.store
            .create_activation_ticket(
                &new_id("tkt"),
                &credential_hash(&ticket),
                &installation.id,
                expires_at,
            )
            .await?;
        Ok(
            json!({ "ticket": ticket, "expires_at": expires_at.to_rfc3339_opts(SecondsFormat::Millis, true) }),
        )
    }

    pub async fn claim_source_activation(
        &self,
        authorization: Option<&str>,
        input: Value,
    ) -> Result<Value> {
        let now = Utc::now();
        let parsed = ClaimSourceActivation::parse(input)?;
        let existing_source = match authorization.filter(|value| !value.is_empty()) {
            Some(authorization) => Some(self.authenticate_source(authorization).await?),
            None => None,
        };

        if existing_source.is_none()
            && !self
                .enrollment_token_hash
                .as_ref()
                .zip(parsed.enrollment_token.as_ref())
                .is_some_and(|(expected, token)| credentials_match(token, expected))
        {
            return Err(http(
                403,
                "source_enrollment_required",
                "Source creation requires operator enrollment approval",
            ));
        }

        let installation_id = self
            .store
            .claim_activation_ticket(&credential_hash(&parsed.ticket), now)
            .await?
            .ok_or_else(|| {
                http(
                    410,
                    "activation_ticket_invalid",
                    "Activation ticket is expired or already claimed",
                )
            })?;

        let installation = self
            .store
            .find_installation(&installation_id)
            .await?
            .ok_or_else(|| http(410, "installation_invalid", "Installation is unavailable"))?;
        if installation.app_id == crate::fanout::SPACE_APP_ID
            && (!parsed.owner_authorized || parsed.reader_id.is_none())
        {
            return Err(http(
                403,
                "owner_required",
                "Space notifications require an authenticated owner",
            ));
        }

        let (source_id, source_secret) = match existing_source {
            Some(source) if source.origin != parsed.source_origin => {
                return Err(http(
                    409,
                    "source_origin_mismatch",
                    "Existing source origin does not match",
                ));
            }
            Some(source) => (source.id, None),
            None => {
                let source_id = new_id("src");
                let source_secret = random_credential("srcsec");
                self.store
                    .create_source(
                        &source_id,
                        &parsed.source_origin,
                        parsed.source_label.as_deref(),
                        &self.vault.encrypt(&source_secret),
                    )
                    .await?;
                (source_id, Some(source_secret))
            }
        };

        let binding_id = self
            .store
            .create_binding(NewBinding {
                id: &new_id("bnd"),
                source_id: &source_id,
                installation_id: &installation_id,
                reader_id: parsed.reader_id.as_deref(),
                preferences: &parsed.preferences.unwrap_or_default(),
                owner_authorized: parsed.owner_authorized,
            })
            .await?;

        let mut response = json!({
            "source_id": source_id,
            "binding_id": binding_id,
            "installation_id": installation_id,
            "event_endpoint": format!("{}/v1/webhooks/mx-core", self.public_url),
        });
        if let Some(secret) = source_secret {
            response["source_secret"] = json!(secret);
        }
        Ok(response)
    }

    pub async fn accept_event(&self, request: WebhookRequest<'_>) -> Result<Value> {
        let (Some(source_id), Some(delivery_id), Some(timestamp), Some(signature)) = (
            request.source_id.filter(|v| !v.is_empty()),
            request.delivery_id.filter(|v| !v.is_empty()),
            request.timestamp.filter(|v| !v.is_empty()),
            request.signature.filter(|v| !v.is_empty()),
        ) else {
            return Err(http(
                400,
                "signature_headers_missing",
                "Push signature headers are required",
            ));
        };
        let now = Utc::now();
        if !is_push_timestamp_fresh(timestamp, now.timestamp_millis()) {
            return Err(http(
                401,
                "stale_request",
                "Push request timestamp is outside the replay window",
            ));
        }
        let source = self
            .store
            .find_source(source_id)
            .await?
            .filter(|source| source.revoked_at.is_none())
            .ok_or_else(|| http(401, "source_invalid", "Push source is unknown or revoked"))?;
        let secret = self.decrypt(&source.secret_ciphertext)?;
        if !verify_push_request_signature(
            &secret,
            timestamp,
            delivery_id,
            request.raw_body,
            signature,
        ) {
            return Err(http(
                401,
                "signature_invalid",
                "Push request signature is invalid",
            ));
        }

        let wire: Value = serde_json::from_slice(request.raw_body)
            .map_err(|_| http(400, "invalid_json", "Request body must be JSON"))?;
        let event = PushEvent::parse(wire)?;
        if event.source() != format!("{SOURCE_URN_PREFIX}{}", source.id) {
            return Err(http(
                422,
                "event_source_mismatch",
                "CloudEvent source does not match its credential",
            ));
        }

        let deliveries = self
            .store
            .accept_event(&source.id, delivery_id, &event, now)
            .await?;
        Ok(json!({ "accepted": true, "event_id": event.id(), "deliveries": deliveries }))
    }

    pub async fn get_binding(
        &self,
        authorization: Option<&str>,
        binding_id: &str,
    ) -> Result<Value> {
        let installation = self.authenticate_installation(authorization).await?;
        let binding = self
            .store
            .find_binding_for_installation(&installation.id, binding_id)
            .await?
            .ok_or_else(|| http(404, "binding_not_found", "Binding not found"))?;
        Ok(json!({
            "binding_id": binding.id,
            "source_id": binding.source_id,
            "installation_id": binding.installation_id,
            "reader_id": binding.reader_id,
            "preferences": binding.preferences,
        }))
    }

    pub async fn revoke_binding(
        &self,
        authorization: Option<&str>,
        binding_id: &str,
    ) -> Result<Value> {
        let installation = self.authenticate_installation(authorization).await?;
        let revoked = self
            .store
            .revoke_binding_for_installation(&installation.id, binding_id, Utc::now())
            .await?;
        if !revoked {
            return Err(http(404, "binding_not_found", "Binding not found"));
        }
        Ok(json!({ "revoked": true }))
    }

    pub async fn update_binding_preferences(
        &self,
        authorization: Option<&str>,
        binding_id: &str,
        input: Value,
    ) -> Result<Value> {
        let installation = self.authenticate_installation(authorization).await?;
        let preferences: PushPreferences = decode(input)?;
        let updated = self
            .store
            .update_binding_preferences_for_installation(&installation.id, binding_id, &preferences)
            .await?;
        if !updated {
            return Err(http(404, "binding_not_found", "Binding not found"));
        }
        Ok(json!({ "updated": true, "binding_id": binding_id, "preferences": preferences }))
    }

    async fn authenticate_installation(
        &self,
        authorization: Option<&str>,
    ) -> Result<InstallationRecord> {
        let (id, secret) = parse_authorization(authorization, "Installation").ok_or_else(|| {
            http(
                401,
                "installation_unauthorized",
                "Installation authorization is required",
            )
        })?;
        match self.store.find_installation(id).await? {
            Some(installation)
                if installation.revoked_at.is_none()
                    && credentials_match(secret, &installation.secret_hash) =>
            {
                Ok(installation)
            }
            _ => Err(http(
                401,
                "installation_unauthorized",
                "Installation credential is invalid",
            )),
        }
    }

    async fn authenticate_source(&self, authorization: &str) -> Result<SourceRecord> {
        let unauthorized = || {
            http(
                401,
                "source_unauthorized",
                "Source authorization is invalid",
            )
        };
        let (id, secret) =
            parse_authorization(Some(authorization), "Source").ok_or_else(unauthorized)?;
        let source = self
            .store
            .find_source(id)
            .await?
            .filter(|source| source.revoked_at.is_none())
            .ok_or_else(unauthorized)?;
        let expected = self.decrypt(&source.secret_ciphertext)?;
        if !credentials_match(secret, &credential_hash(&expected)) {
            return Err(unauthorized());
        }
        Ok(source)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn self_enrolled_installation_cannot_mint_a_source() {
        let store = Store::open(":memory:").await.unwrap();
        store.migrate().await.unwrap();
        let relay = RelayService::new(
            store,
            DataVault::new(&"11".repeat(32)).unwrap(),
            "https://relay.test".into(),
            HashSet::from(["space".into()]),
            None,
        );
        let result = relay
            .claim_source_activation(
                None,
                json!({ "ticket": "t".repeat(32), "source_origin": "https://victim.test" }),
            )
            .await;
        assert!(matches!(result, Err(RelayError::Http { status: 403, .. })));
    }

    #[tokio::test]
    async fn approved_sources_still_need_owner_authority_for_space() {
        let store = Store::open(":memory:").await.unwrap();
        store.migrate().await.unwrap();
        let relay = RelayService::new(
            store.clone(),
            DataVault::new(&"11".repeat(32)).unwrap(),
            "https://relay.test".into(),
            HashSet::from(["space".into()]),
            Some("operator-approval-token-32-characters".into()),
        );
        let installation = relay.register_installation(json!({ "app_id": "space", "apns_environment": "production", "apns_token": "ab".repeat(32) })).await.ok().unwrap();
        let authorization = format!(
            "Installation {}.{}",
            installation["installation_id"].as_str().unwrap(),
            installation["installation_secret"].as_str().unwrap()
        );
        let ticket = relay
            .create_activation_ticket(Some(&authorization))
            .await
            .ok()
            .unwrap();
        let rejected = relay.claim_source_activation(None, json!({ "ticket": ticket["ticket"], "source_origin": "https://core.test", "enrollment_token": "operator-approval-token-32-characters" })).await;
        assert!(matches!(
            rejected,
            Err(RelayError::Http { status: 403, .. })
        ));
        let ticket = relay
            .create_activation_ticket(Some(&authorization))
            .await
            .ok()
            .unwrap();
        let accepted = relay.claim_source_activation(None, json!({ "ticket": ticket["ticket"], "source_origin": "https://core.test", "enrollment_token": "operator-approval-token-32-characters", "owner_authorized": true, "reader_id": "owner" })).await;
        assert!(accepted.is_ok());
    }

    #[test]
    fn parses_authorization() {
        assert_eq!(
            parse_authorization(Some("Installation ins_1.secret"), "Installation"),
            Some(("ins_1", "secret"))
        );
        assert_eq!(
            parse_authorization(Some("Installation ins_1."), "Installation"),
            Some(("ins_1", ""))
        );
        assert_eq!(
            parse_authorization(Some("Installation .secret"), "Installation"),
            None
        );
        assert_eq!(
            parse_authorization(Some("Source ins_1.secret"), "Installation"),
            None
        );
        assert_eq!(parse_authorization(None, "Installation"), None);
    }
}
