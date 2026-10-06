use chrono::{DateTime, Utc};
use deadpool_postgres::Pool;
use serde_json::Value;
use tokio_postgres::Row;

use crate::fanout::{FANOUT_DELIVERY_INSERT_SQL, fanout_query_for_event};
use crate::protocol::{ApnsEnvironment, PushEvent, PushPreferences};
use crate::validate::parse_iso_datetime;

#[derive(Debug)]
pub struct DbError(pub String);

impl std::fmt::Display for DbError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl From<tokio_postgres::Error> for DbError {
    fn from(error: tokio_postgres::Error) -> Self {
        Self(error.to_string())
    }
}

impl From<deadpool_postgres::PoolError> for DbError {
    fn from(error: deadpool_postgres::PoolError) -> Self {
        Self(error.to_string())
    }
}

type Result<T> = std::result::Result<T, DbError>;

pub struct InstallationRecord {
    pub id: String,
    pub secret_hash: String,
    pub revoked_at: Option<DateTime<Utc>>,
}

pub struct SourceRecord {
    pub id: String,
    pub secret_ciphertext: String,
    pub origin: String,
    pub revoked_at: Option<DateTime<Utc>>,
}

pub struct BindingRecord {
    pub id: String,
    pub source_id: String,
    pub installation_id: String,
    pub reader_id: Option<String>,
    pub preferences: Value,
}

pub struct DeliveryRecord {
    pub id: String,
    pub installation_id: String,
    pub app_id: String,
    pub apns_environment: ApnsEnvironment,
    pub token_ciphertext: String,
    pub event: std::result::Result<PushEvent, String>,
    pub attempt: i32,
}

pub struct NewInstallation<'a> {
    pub id: &'a str,
    pub app_id: &'a str,
    pub apns_environment: ApnsEnvironment,
    pub token_hash: &'a str,
    pub token_ciphertext: &'a str,
    pub secret_hash: &'a str,
}

pub struct NewBinding<'a> {
    pub id: &'a str,
    pub source_id: &'a str,
    pub installation_id: &'a str,
    pub reader_id: Option<&'a str>,
    pub preferences: &'a PushPreferences,
}

fn environment(row: &Row, column: &str) -> Result<ApnsEnvironment> {
    let value: String = row.get(column);
    ApnsEnvironment::parse(&value)
        .ok_or_else(|| DbError(format!("Unknown APNs environment {value}")))
}

#[derive(Clone)]
pub struct Store {
    pool: Pool,
}

impl Store {
    pub fn new(pool: Pool) -> Self {
        Self { pool }
    }

    pub async fn create_installation(&self, input: NewInstallation<'_>) -> Result<()> {
        let client = self.pool.get().await?;
        client
            .execute(
                "INSERT INTO push_installations
                 (id, app_id, apns_environment, token_hash, token_ciphertext, secret_hash)
                 VALUES ($1, $2, $3, $4, $5, $6)",
                &[
                    &input.id,
                    &input.app_id,
                    &input.apns_environment.as_str(),
                    &input.token_hash,
                    &input.token_ciphertext,
                    &input.secret_hash,
                ],
            )
            .await?;
        Ok(())
    }

    pub async fn find_installation(&self, id: &str) -> Result<Option<InstallationRecord>> {
        let client = self.pool.get().await?;
        let row = client
            .query_opt(
                "SELECT id, secret_hash, revoked_at FROM push_installations WHERE id = $1",
                &[&id],
            )
            .await?;
        Ok(row.map(|row| InstallationRecord {
            id: row.get("id"),
            secret_hash: row.get("secret_hash"),
            revoked_at: row.get("revoked_at"),
        }))
    }

    pub async fn update_installation_token(
        &self,
        id: &str,
        apns_environment: ApnsEnvironment,
        token_hash: &str,
        token_ciphertext: &str,
    ) -> Result<bool> {
        let client = self.pool.get().await?;
        let updated = client
            .execute(
                "UPDATE push_installations
                 SET apns_environment = $2, token_hash = $3, token_ciphertext = $4,
                     revoked_at = NULL, updated_at = now()
                 WHERE id = $1",
                &[
                    &id,
                    &apns_environment.as_str(),
                    &token_hash,
                    &token_ciphertext,
                ],
            )
            .await?;
        Ok(updated == 1)
    }

    pub async fn create_activation_ticket(
        &self,
        id: &str,
        ticket_hash: &str,
        installation_id: &str,
        expires_at: DateTime<Utc>,
    ) -> Result<()> {
        let client = self.pool.get().await?;
        client
            .execute(
                "INSERT INTO push_activation_tickets (id, ticket_hash, installation_id, expires_at)
                 VALUES ($1, $2, $3, $4)",
                &[&id, &ticket_hash, &installation_id, &expires_at],
            )
            .await?;
        Ok(())
    }

    pub async fn claim_activation_ticket(
        &self,
        ticket_hash: &str,
        now: DateTime<Utc>,
    ) -> Result<Option<String>> {
        let mut client = self.pool.get().await?;
        let tx = client.transaction().await?;
        let row = tx
            .query_opt(
                "SELECT installation_id, expires_at, claimed_at
                 FROM push_activation_tickets
                 WHERE ticket_hash = $1 FOR UPDATE",
                &[&ticket_hash],
            )
            .await?;
        let Some(row) = row else {
            tx.commit().await?;
            return Ok(None);
        };
        let claimed_at: Option<DateTime<Utc>> = row.get("claimed_at");
        let expires_at: DateTime<Utc> = row.get("expires_at");
        if claimed_at.is_some() || expires_at <= now {
            tx.commit().await?;
            return Ok(None);
        }
        tx.execute(
            "UPDATE push_activation_tickets SET claimed_at = $2 WHERE ticket_hash = $1",
            &[&ticket_hash, &now],
        )
        .await?;
        tx.commit().await?;
        Ok(Some(row.get("installation_id")))
    }

    pub async fn create_source(
        &self,
        id: &str,
        origin: &str,
        label: Option<&str>,
        secret_ciphertext: &str,
    ) -> Result<()> {
        let client = self.pool.get().await?;
        client
            .execute(
                "INSERT INTO push_sources (id, origin, label, secret_ciphertext) VALUES ($1, $2, $3, $4)",
                &[&id, &origin, &label, &secret_ciphertext],
            )
            .await?;
        Ok(())
    }

    pub async fn find_source(&self, id: &str) -> Result<Option<SourceRecord>> {
        let client = self.pool.get().await?;
        let row = client
            .query_opt(
                "SELECT id, secret_ciphertext, origin, revoked_at FROM push_sources WHERE id = $1",
                &[&id],
            )
            .await?;
        Ok(row.map(|row| SourceRecord {
            id: row.get("id"),
            secret_ciphertext: row.get("secret_ciphertext"),
            origin: row.get("origin"),
            revoked_at: row.get("revoked_at"),
        }))
    }

    pub async fn create_binding(&self, input: NewBinding<'_>) -> Result<String> {
        let client = self.pool.get().await?;
        let preferences =
            serde_json::to_value(input.preferences).map_err(|e| DbError(e.to_string()))?;
        let row = client
            .query_one(
                "INSERT INTO push_bindings (id, source_id, installation_id, reader_id, preferences)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (source_id, installation_id)
                 DO UPDATE SET revoked_at = NULL, reader_id = EXCLUDED.reader_id,
                     updated_at = now()
                 RETURNING id",
                &[
                    &input.id,
                    &input.source_id,
                    &input.installation_id,
                    &input.reader_id,
                    &preferences,
                ],
            )
            .await?;
        Ok(row.get("id"))
    }

    pub async fn find_binding_for_installation(
        &self,
        installation_id: &str,
        binding_id: &str,
    ) -> Result<Option<BindingRecord>> {
        let client = self.pool.get().await?;
        let row = client
            .query_opt(
                "SELECT id, source_id, installation_id, reader_id, preferences
                 FROM push_bindings
                 WHERE id = $2 AND installation_id = $1 AND revoked_at IS NULL",
                &[&installation_id, &binding_id],
            )
            .await?;
        Ok(row.map(|row| BindingRecord {
            id: row.get("id"),
            source_id: row.get("source_id"),
            installation_id: row.get("installation_id"),
            reader_id: row.get("reader_id"),
            preferences: row.get("preferences"),
        }))
    }

    pub async fn update_binding_preferences_for_installation(
        &self,
        installation_id: &str,
        binding_id: &str,
        preferences: &PushPreferences,
    ) -> Result<bool> {
        let client = self.pool.get().await?;
        let preferences = serde_json::to_value(preferences).map_err(|e| DbError(e.to_string()))?;
        let updated = client
            .execute(
                "UPDATE push_bindings SET preferences = $3, updated_at = now()
                 WHERE installation_id = $1 AND id = $2 AND revoked_at IS NULL",
                &[&installation_id, &binding_id, &preferences],
            )
            .await?;
        Ok(updated == 1)
    }

    pub async fn revoke_binding_for_installation(
        &self,
        installation_id: &str,
        binding_id: &str,
        now: DateTime<Utc>,
    ) -> Result<bool> {
        let client = self.pool.get().await?;
        let updated = client
            .execute(
                "UPDATE push_bindings SET revoked_at = $3, updated_at = $3
                 WHERE installation_id = $1 AND id = $2 AND revoked_at IS NULL",
                &[&installation_id, &binding_id, &now],
            )
            .await?;
        Ok(updated == 1)
    }

    pub async fn accept_event(
        &self,
        source_id: &str,
        delivery_id: &str,
        event: &PushEvent,
        now: DateTime<Utc>,
    ) -> Result<u64> {
        let payload = serde_json::to_value(event).map_err(|e| DbError(e.to_string()))?;
        let event_time =
            parse_iso_datetime(event.time()).ok_or_else(|| DbError("Invalid event time".into()))?;
        let mut client = self.pool.get().await?;
        let tx = client.transaction().await?;
        let inserted = tx
            .execute(
                "INSERT INTO push_events
                 (id, source_id, delivery_id, event_type, subject, payload, event_time, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (source_id, id) DO NOTHING",
                &[
                    &event.id(),
                    &source_id,
                    &delivery_id,
                    &event.event_type(),
                    &event.subject(),
                    &payload,
                    &event_time,
                    &now,
                ],
            )
            .await?;
        let deliveries = if inserted == 0 {
            let row = tx
                .query_one(
                    "SELECT count(*) AS count FROM push_deliveries WHERE source_id = $1 AND event_id = $2",
                    &[&source_id, &event.id()],
                )
                .await?;
            row.get::<_, i64>("count") as u64
        } else {
            let fanout = fanout_query_for_event(event);
            tx.execute(
                FANOUT_DELIVERY_INSERT_SQL,
                &[
                    &event.id(),
                    &source_id,
                    &now,
                    &fanout.app_id,
                    &fanout.reader_id,
                    &fanout.preference_key,
                ],
            )
            .await?
        };
        tx.commit().await?;
        Ok(deliveries)
    }

    pub async fn claim_deliveries(
        &self,
        limit: i64,
        now: DateTime<Utc>,
    ) -> Result<Vec<DeliveryRecord>> {
        let mut client = self.pool.get().await?;
        let tx = client.transaction().await?;
        let rows = tx
            .query(
                "WITH candidates AS (
                   SELECT id FROM push_deliveries
                   WHERE status IN ('pending', 'retrying') AND next_attempt_at <= $1
                   ORDER BY next_attempt_at, created_at
                   FOR UPDATE SKIP LOCKED LIMIT $2
                 ), claimed AS (
                   UPDATE push_deliveries d
                   SET status = 'processing', attempt = attempt + 1, updated_at = $1
                   FROM candidates c WHERE d.id = c.id
                   RETURNING d.*
                 )
                 SELECT c.id, c.installation_id, i.app_id,
                        i.apns_environment, i.token_ciphertext, e.payload, c.attempt
                 FROM claimed c
                 JOIN push_installations i ON i.id = c.installation_id
                 JOIN push_events e ON e.source_id = c.source_id AND e.id = c.event_id",
                &[&now, &limit],
            )
            .await?;
        tx.commit().await?;
        rows.iter()
            .map(|row| {
                Ok(DeliveryRecord {
                    id: row.get("id"),
                    installation_id: row.get("installation_id"),
                    app_id: row.get("app_id"),
                    apns_environment: environment(row, "apns_environment")?,
                    token_ciphertext: row.get("token_ciphertext"),
                    event: PushEvent::decode(row.get("payload"))
                        .map_err(|issues| format!("Stored event is invalid: {issues:?}")),
                    attempt: row.get("attempt"),
                })
            })
            .collect()
    }

    pub async fn complete_delivery(
        &self,
        id: &str,
        apns_id: Option<&str>,
        now: DateTime<Utc>,
    ) -> Result<()> {
        let client = self.pool.get().await?;
        client
            .execute(
                "UPDATE push_deliveries SET status = 'delivered', apns_id = $2,
                 delivered_at = $3, updated_at = $3 WHERE id = $1",
                &[&id, &apns_id, &now],
            )
            .await?;
        Ok(())
    }

    pub async fn retry_delivery(
        &self,
        id: &str,
        error: &str,
        next_attempt_at: DateTime<Utc>,
        now: DateTime<Utc>,
    ) -> Result<()> {
        let client = self.pool.get().await?;
        client
            .execute(
                "UPDATE push_deliveries SET status = 'retrying', last_error = $2,
                 next_attempt_at = $3, updated_at = $4 WHERE id = $1",
                &[&id, &error, &next_attempt_at, &now],
            )
            .await?;
        Ok(())
    }

    pub async fn fail_delivery(&self, id: &str, error: &str, now: DateTime<Utc>) -> Result<()> {
        let client = self.pool.get().await?;
        client
            .execute(
                "UPDATE push_deliveries SET status = 'failed', last_error = $2, updated_at = $3 WHERE id = $1",
                &[&id, &error, &now],
            )
            .await?;
        Ok(())
    }

    pub async fn revoke_installation(&self, id: &str, now: DateTime<Utc>) -> Result<()> {
        let client = self.pool.get().await?;
        client
            .execute(
                "UPDATE push_installations SET revoked_at = $2, updated_at = $2 WHERE id = $1",
                &[&id, &now],
            )
            .await?;
        Ok(())
    }
}
