use std::time::Duration;

use chrono::{DateTime, Utc};
use serde_json::Value;
use tokio_rusqlite::Connection;
use tokio_rusqlite::rusqlite::{self, OptionalExtension, Row, params};

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

impl From<tokio_rusqlite::Error> for DbError {
    fn from(error: tokio_rusqlite::Error) -> Self {
        Self(error.to_string())
    }
}

impl From<rusqlite::Error> for DbError {
    fn from(error: rusqlite::Error) -> Self {
        Self(error.to_string())
    }
}

type Result<T> = std::result::Result<T, DbError>;

pub struct InstallationRecord {
    pub id: String,
    pub secret_hash: String,
    pub revoked_at: Option<i64>,
}

pub struct SourceRecord {
    pub id: String,
    pub secret_ciphertext: String,
    pub origin: String,
    pub revoked_at: Option<i64>,
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

fn delivery(row: &Row<'_>) -> rusqlite::Result<DeliveryRecord> {
    let environment: String = row.get("apns_environment")?;
    let apns_environment = ApnsEnvironment::parse(&environment).ok_or_else(|| {
        rusqlite::Error::FromSqlConversionFailure(
            3,
            rusqlite::types::Type::Text,
            format!("Unknown APNs environment {environment}").into(),
        )
    })?;
    Ok(DeliveryRecord {
        id: row.get("id")?,
        installation_id: row.get("installation_id")?,
        app_id: row.get("app_id")?,
        apns_environment,
        token_ciphertext: row.get("token_ciphertext")?,
        event: PushEvent::decode(row.get("payload")?)
            .map_err(|issues| format!("Stored event is invalid: {issues:?}")),
        attempt: row.get("attempt")?,
    })
}

#[derive(Clone)]
pub struct Store {
    connection: Connection,
}

impl Store {
    pub async fn open(path: &str) -> Result<Self> {
        let connection = Connection::open(path).await?;
        connection
            .call(|conn| {
                conn.busy_timeout(Duration::from_secs(5))?;
                conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")
            })
            .await?;
        Ok(Self { connection })
    }

    pub async fn migrate(&self) -> Result<()> {
        self.connection
            .call(crate::migrate::run)
            .await
            .map_err(Into::into)
    }

    pub async fn resume_deliveries(&self) -> Result<()> {
        self.connection
            .call(|conn| {
                // Only one relay process may use this file; interrupted sends are retried.
                conn.execute(
                    "UPDATE push_deliveries SET status = 'retrying', updated_at = ?1
                     WHERE status = 'processing'",
                    [Utc::now().timestamp_millis()],
                )?;
                Ok(())
            })
            .await
            .map_err(Into::into)
    }

    pub async fn create_installation(&self, input: NewInstallation<'_>) -> Result<()> {
        let values = (
            input.id.to_owned(),
            input.app_id.to_owned(),
            input.apns_environment.as_str(),
            input.token_hash.to_owned(),
            input.token_ciphertext.to_owned(),
            input.secret_hash.to_owned(),
        );
        self.connection
            .call(move |conn| {
                conn.execute(
                    "INSERT INTO push_installations
                     (id, app_id, apns_environment, token_hash, token_ciphertext, secret_hash)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    values,
                )?;
                Ok(())
            })
            .await
            .map_err(Into::into)
    }

    pub async fn find_installation(&self, id: &str) -> Result<Option<InstallationRecord>> {
        let id = id.to_owned();
        self.connection
            .call(move |conn| {
                conn.query_row(
                    "SELECT id, secret_hash, revoked_at FROM push_installations WHERE id = ?1",
                    [id],
                    |row| {
                        Ok(InstallationRecord {
                            id: row.get("id")?,
                            secret_hash: row.get("secret_hash")?,
                            revoked_at: row.get("revoked_at")?,
                        })
                    },
                )
                .optional()
            })
            .await
            .map_err(Into::into)
    }

    pub async fn update_installation_token(
        &self,
        id: &str,
        apns_environment: ApnsEnvironment,
        token_hash: &str,
        token_ciphertext: &str,
    ) -> Result<bool> {
        let values = (
            id.to_owned(),
            apns_environment.as_str(),
            token_hash.to_owned(),
            token_ciphertext.to_owned(),
        );
        self.connection
            .call(move |conn| {
                Ok(conn.execute(
                    "UPDATE push_installations
                     SET apns_environment = ?2, token_hash = ?3, token_ciphertext = ?4,
                         revoked_at = NULL, updated_at = unixepoch() * 1000
                     WHERE id = ?1",
                    values,
                )? == 1)
            })
            .await
            .map_err(Into::into)
    }

    pub async fn create_activation_ticket(
        &self,
        id: &str,
        ticket_hash: &str,
        installation_id: &str,
        expires_at: DateTime<Utc>,
    ) -> Result<()> {
        let values = (
            id.to_owned(),
            ticket_hash.to_owned(),
            installation_id.to_owned(),
            expires_at.timestamp_millis(),
        );
        self.connection
            .call(move |conn| {
                conn.execute(
                    "INSERT INTO push_activation_tickets (id, ticket_hash, installation_id, expires_at)
                     VALUES (?1, ?2, ?3, ?4)",
                    values,
                )?;
                Ok(())
            })
            .await
            .map_err(Into::into)
    }

    pub async fn claim_activation_ticket(
        &self,
        ticket_hash: &str,
        now: DateTime<Utc>,
    ) -> Result<Option<String>> {
        let ticket_hash = ticket_hash.to_owned();
        self.connection
            .call(move |conn| {
                conn.query_row(
                    "UPDATE push_activation_tickets SET claimed_at = ?2
                     WHERE ticket_hash = ?1 AND claimed_at IS NULL AND expires_at > ?2
                     RETURNING installation_id",
                    params![ticket_hash, now.timestamp_millis()],
                    |row| row.get(0),
                )
                .optional()
            })
            .await
            .map_err(Into::into)
    }

    pub async fn create_source(
        &self,
        id: &str,
        origin: &str,
        label: Option<&str>,
        secret_ciphertext: &str,
    ) -> Result<()> {
        let values = (
            id.to_owned(),
            origin.to_owned(),
            label.map(str::to_owned),
            secret_ciphertext.to_owned(),
        );
        self.connection
            .call(move |conn| {
                conn.execute(
                    "INSERT INTO push_sources (id, origin, label, secret_ciphertext) VALUES (?1, ?2, ?3, ?4)",
                    values,
                )?;
                Ok(())
            })
            .await
            .map_err(Into::into)
    }

    pub async fn find_source(&self, id: &str) -> Result<Option<SourceRecord>> {
        let id = id.to_owned();
        self.connection
            .call(move |conn| {
                conn.query_row(
                    "SELECT id, secret_ciphertext, origin, revoked_at FROM push_sources WHERE id = ?1",
                    [id],
                    |row| Ok(SourceRecord {
                        id: row.get("id")?,
                        secret_ciphertext: row.get("secret_ciphertext")?,
                        origin: row.get("origin")?,
                        revoked_at: row.get("revoked_at")?,
                    }),
                ).optional()
            })
            .await
            .map_err(Into::into)
    }

    pub async fn create_binding(&self, input: NewBinding<'_>) -> Result<String> {
        let values = (
            input.id.to_owned(),
            input.source_id.to_owned(),
            input.installation_id.to_owned(),
            input.reader_id.map(str::to_owned),
            serde_json::to_value(input.preferences).map_err(|e| DbError(e.to_string()))?,
        );
        self.connection
            .call(move |conn| {
                conn.query_row(
                    "INSERT INTO push_bindings (id, source_id, installation_id, reader_id, preferences)
                     VALUES (?1, ?2, ?3, ?4, ?5)
                     ON CONFLICT (source_id, installation_id)
                     DO UPDATE SET revoked_at = NULL, reader_id = excluded.reader_id,
                         updated_at = unixepoch() * 1000
                     RETURNING id",
                    values,
                    |row| row.get(0),
                )
            })
            .await
            .map_err(Into::into)
    }

    pub async fn find_binding_for_installation(
        &self,
        installation_id: &str,
        binding_id: &str,
    ) -> Result<Option<BindingRecord>> {
        let values = (installation_id.to_owned(), binding_id.to_owned());
        self.connection
            .call(move |conn| {
                conn.query_row(
                    "SELECT id, source_id, installation_id, reader_id, preferences
                     FROM push_bindings
                     WHERE id = ?2 AND installation_id = ?1 AND revoked_at IS NULL",
                    values,
                    |row| {
                        Ok(BindingRecord {
                            id: row.get("id")?,
                            source_id: row.get("source_id")?,
                            installation_id: row.get("installation_id")?,
                            reader_id: row.get("reader_id")?,
                            preferences: row.get("preferences")?,
                        })
                    },
                )
                .optional()
            })
            .await
            .map_err(Into::into)
    }

    pub async fn update_binding_preferences_for_installation(
        &self,
        installation_id: &str,
        binding_id: &str,
        preferences: &PushPreferences,
    ) -> Result<bool> {
        let values = (
            installation_id.to_owned(),
            binding_id.to_owned(),
            serde_json::to_value(preferences).map_err(|e| DbError(e.to_string()))?,
        );
        self.connection
            .call(move |conn| {
                Ok(conn.execute(
                    "UPDATE push_bindings SET preferences = ?3, updated_at = unixepoch() * 1000
                     WHERE installation_id = ?1 AND id = ?2 AND revoked_at IS NULL",
                    values,
                )? == 1)
            })
            .await
            .map_err(Into::into)
    }

    pub async fn revoke_binding_for_installation(
        &self,
        installation_id: &str,
        binding_id: &str,
        now: DateTime<Utc>,
    ) -> Result<bool> {
        let values = (
            installation_id.to_owned(),
            binding_id.to_owned(),
            now.timestamp_millis(),
        );
        self.connection
            .call(move |conn| {
                Ok(conn.execute(
                    "UPDATE push_bindings SET revoked_at = ?3, updated_at = ?3
                     WHERE installation_id = ?1 AND id = ?2 AND revoked_at IS NULL",
                    values,
                )? == 1)
            })
            .await
            .map_err(Into::into)
    }

    pub async fn accept_event(
        &self,
        source_id: &str,
        delivery_id: &str,
        event: &PushEvent,
        now: DateTime<Utc>,
    ) -> Result<u64> {
        let payload = serde_json::to_value(event).map_err(|e| DbError(e.to_string()))?;
        let event_time = parse_iso_datetime(event.time())
            .ok_or_else(|| DbError("Invalid event time".into()))?
            .timestamp_millis();
        let fanout = fanout_query_for_event(event);
        let (app_id, reader_id, preference_key) = (
            fanout.app_id,
            fanout.reader_id.map(str::to_owned),
            fanout.preference_key,
        );
        let values = (
            event.id().to_owned(),
            source_id.to_owned(),
            delivery_id.to_owned(),
            event.event_type().to_owned(),
            event.subject().to_owned(),
        );
        let now = now.timestamp_millis();
        self.connection
            .call(move |conn| {
                let tx = conn.transaction()?;
                let (event_id, source_id, delivery_id, event_type, subject) = values;
                let inserted = tx.execute(
                    "INSERT INTO push_events
                     (id, source_id, delivery_id, event_type, subject, payload, event_time, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                     ON CONFLICT (source_id, id) DO NOTHING",
                    params![event_id, source_id, delivery_id, event_type, subject, payload, event_time, now],
                )?;
                let deliveries = if inserted == 0 {
                    tx.query_row(
                        "SELECT count(*) FROM push_deliveries WHERE source_id = ?1 AND event_id = ?2",
                        params![source_id, event_id],
                        |row| row.get::<_, i64>(0).map(|count| count as u64),
                    )?
                } else {
                    tx.execute(FANOUT_DELIVERY_INSERT_SQL, params![event_id, source_id, now, app_id, reader_id, preference_key])? as u64
                };
                tx.commit()?;
                Ok(deliveries)
            })
            .await
            .map_err(Into::into)
    }

    pub async fn claim_deliveries(
        &self,
        limit: i64,
        now: DateTime<Utc>,
    ) -> Result<Vec<DeliveryRecord>> {
        self.connection
            .call(move |conn| {
                let tx = conn.transaction()?;
                let deliveries = tx.prepare(
                    "SELECT d.id, d.installation_id, i.app_id, i.apns_environment,
                            i.token_ciphertext, e.payload, d.attempt + 1 AS attempt
                     FROM push_deliveries d
                     JOIN push_installations i ON i.id = d.installation_id
                     JOIN push_events e ON e.source_id = d.source_id AND e.id = d.event_id
                     WHERE d.status IN ('pending', 'retrying') AND d.next_attempt_at <= ?1
                     ORDER BY d.next_attempt_at, d.created_at, d.id LIMIT ?2",
                )?.query_map(params![now.timestamp_millis(), limit], delivery)?.collect::<rusqlite::Result<Vec<_>>>()?;
                for delivery in &deliveries {
                    tx.execute(
                        "UPDATE push_deliveries SET status = 'processing', attempt = attempt + 1, updated_at = ?1
                         WHERE id = ?2",
                        params![now.timestamp_millis(), delivery.id],
                    )?;
                }
                tx.commit()?;
                Ok(deliveries)
            })
            .await
            .map_err(Into::into)
    }

    pub async fn complete_delivery(
        &self,
        id: &str,
        apns_id: Option<&str>,
        now: DateTime<Utc>,
    ) -> Result<()> {
        let values = (
            id.to_owned(),
            apns_id.map(str::to_owned),
            now.timestamp_millis(),
        );
        self.connection
            .call(move |conn| {
                conn.execute(
                    "UPDATE push_deliveries SET status = 'delivered', apns_id = ?2,
                     delivered_at = ?3, updated_at = ?3 WHERE id = ?1",
                    values,
                )?;
                Ok(())
            })
            .await
            .map_err(Into::into)
    }

    pub async fn retry_delivery(
        &self,
        id: &str,
        error: &str,
        next_attempt_at: DateTime<Utc>,
        now: DateTime<Utc>,
    ) -> Result<()> {
        let values = (
            id.to_owned(),
            error.to_owned(),
            next_attempt_at.timestamp_millis(),
            now.timestamp_millis(),
        );
        self.connection
            .call(move |conn| {
                conn.execute(
                    "UPDATE push_deliveries SET status = 'retrying', last_error = ?2,
                     next_attempt_at = ?3, updated_at = ?4 WHERE id = ?1",
                    values,
                )?;
                Ok(())
            })
            .await
            .map_err(Into::into)
    }

    pub async fn fail_delivery(&self, id: &str, error: &str, now: DateTime<Utc>) -> Result<()> {
        let values = (id.to_owned(), error.to_owned(), now.timestamp_millis());
        self.connection
            .call(move |conn| {
                conn.execute(
                    "UPDATE push_deliveries SET status = 'failed', last_error = ?2, updated_at = ?3 WHERE id = ?1", values,
                )?;
                Ok(())
            })
            .await
            .map_err(Into::into)
    }

    pub async fn revoke_installation(&self, id: &str, now: DateTime<Utc>) -> Result<()> {
        let values = (id.to_owned(), now.timestamp_millis());
        self.connection
            .call(move |conn| {
                conn.execute(
                    "UPDATE push_installations SET revoked_at = ?2, updated_at = ?2 WHERE id = ?1",
                    values,
                )?;
                Ok(())
            })
            .await
            .map_err(Into::into)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeDelta;
    use serde_json::json;

    async fn store() -> Store {
        let store = Store::open(":memory:").await.unwrap();
        store.migrate().await.unwrap();
        store
            .create_source("src_1", "https://example.com", None, "encrypted-source")
            .await
            .unwrap();
        store
    }

    async fn bind(
        store: &Store,
        id: &str,
        app: &str,
        reader: Option<&str>,
        preferences: &PushPreferences,
    ) {
        store
            .create_installation(NewInstallation {
                id,
                app_id: app,
                apns_environment: ApnsEnvironment::Production,
                token_hash: &"a".repeat(64),
                token_ciphertext: "encrypted-token",
                secret_hash: &"b".repeat(64),
            })
            .await
            .unwrap();
        store
            .create_binding(NewBinding {
                id: &format!("bnd_{id}"),
                source_id: "src_1",
                installation_id: id,
                reader_id: reader,
                preferences,
            })
            .await
            .unwrap();
    }

    fn event(id: &str, event_type: &str, data: Value) -> PushEvent {
        PushEvent::parse(json!({
            "specversion": "1.0", "id": id, "source": "urn:mx-core:instance:src_1",
            "time": "2026-10-18T00:00:00.000Z", "datacontenttype": "application/json",
            "type": event_type, "subject": format!("{}/{}", data["resource_type"].as_str().unwrap(), data["resource_id"].as_str().unwrap()),
            "data": data,
        })).unwrap()
    }

    fn comment(id: &str) -> PushEvent {
        event(
            id,
            crate::protocol::COMMENT_CREATED_EVENT,
            json!({ "resource_id": "c1", "resource_type": "comment" }),
        )
    }

    #[tokio::test]
    async fn activation_tickets_are_single_use_and_expire_at_the_boundary() {
        let store = store().await;
        bind(&store, "ins_1", "space", None, &PushPreferences::default()).await;
        let now = Utc::now();
        let expires = now + TimeDelta::minutes(10);
        let hash = "c".repeat(64);
        store
            .create_activation_ticket("t1", &hash, "ins_1", expires)
            .await
            .unwrap();
        let (first, second) = tokio::join!(
            store.claim_activation_ticket(&hash, now),
            store.claim_activation_ticket(&hash, now)
        );
        assert_eq!(
            usize::from(first.unwrap().is_some()) + usize::from(second.unwrap().is_some()),
            1
        );
        let hash = "d".repeat(64);
        store
            .create_activation_ticket("t2", &hash, "ins_1", expires)
            .await
            .unwrap();
        assert!(
            store
                .claim_activation_ticket(&hash, expires)
                .await
                .unwrap()
                .is_none()
        );
        assert!(
            store
                .claim_activation_ticket("missing", now)
                .await
                .unwrap()
                .is_none()
        );
        assert!(
            store
                .create_activation_ticket("t3", &"e".repeat(64), "missing", expires)
                .await
                .is_err()
        );
    }

    #[tokio::test]
    async fn events_route_by_app_reader_preferences_and_revocation_without_duplicates() {
        let store = store().await;
        let preferences = PushPreferences::default();
        bind(&store, "space", "space", None, &preferences).await;
        bind(&store, "r1", "yohaku", Some("reader1"), &preferences).await;
        bind(&store, "r2", "yohaku", Some("reader2"), &preferences).await;
        let disabled = PushPreferences {
            content_post: false,
            ..preferences.clone()
        };
        assert!(
            !store
                .update_binding_preferences_for_installation("r2", "bnd_r1", &disabled)
                .await
                .unwrap()
        );
        assert!(
            store
                .update_binding_preferences_for_installation("r1", "bnd_r1", &disabled)
                .await
                .unwrap()
        );
        assert!(
            store
                .find_binding_for_installation("r2", "bnd_r1")
                .await
                .unwrap()
                .is_none()
        );
        let now = Utc::now();
        let post = event(
            "post",
            crate::protocol::CONTENT_PUBLISHED_EVENT,
            json!({ "resource_id": "p1", "resource_type": "post", "display_title": "Title", "target_path": "/posts/1" }),
        );
        assert_eq!(
            store.accept_event("src_1", "d1", &post, now).await.unwrap(),
            1
        );
        assert_eq!(
            store.accept_event("src_1", "d2", &post, now).await.unwrap(),
            1
        );
        let reply = event(
            "reply",
            crate::protocol::COMMENT_REPLIED_EVENT,
            json!({
                "resource_id": "c2", "resource_type": "comment", "recipient_reader_id": "reader1",
                "sender_id": "sender", "sender_name": "Sender", "target_title": "Title", "target_path": "/posts/1"
            }),
        );
        assert_eq!(
            store
                .accept_event("src_1", "d3", &reply, now)
                .await
                .unwrap(),
            1
        );
        assert_eq!(
            store
                .accept_event("src_1", "d4", &comment("comment1"), now)
                .await
                .unwrap(),
            1
        );
        let deliveries = store.claim_deliveries(25, now).await.unwrap();
        assert_eq!(deliveries.len(), 3);
        assert!(deliveries.iter().all(|d| d.event.is_ok()));
        assert!(
            store
                .revoke_binding_for_installation("r1", "bnd_r1", now)
                .await
                .unwrap()
        );
        store.revoke_installation("r2", now).await.unwrap();
        let mut post = serde_json::to_value(post).unwrap();
        post["id"] = json!("post2");
        assert_eq!(
            store
                .accept_event("src_1", "d5", &PushEvent::parse(post).unwrap(), now)
                .await
                .unwrap(),
            0
        );
        assert!(
            store
                .update_installation_token(
                    "r2",
                    ApnsEnvironment::Development,
                    &"f".repeat(64),
                    "new-token"
                )
                .await
                .unwrap()
        );
        assert!(
            store
                .find_installation("r2")
                .await
                .unwrap()
                .unwrap()
                .revoked_at
                .is_none()
        );
        let rebound = store
            .create_binding(NewBinding {
                id: "ignored-id",
                source_id: "src_1",
                installation_id: "r1",
                reader_id: Some("reader3"),
                preferences: &preferences,
            })
            .await
            .unwrap();
        assert_eq!(rebound, "bnd_r1");
        let binding = store
            .find_binding_for_installation("r1", &rebound)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(binding.reader_id.as_deref(), Some("reader3"));
        assert_eq!(binding.preferences, serde_json::to_value(disabled).unwrap());
    }

    #[tokio::test]
    async fn event_acceptance_rolls_back_when_fanout_fails() {
        let store = store().await;
        bind(&store, "ins_1", "space", None, &PushPreferences::default()).await;
        store.connection.call(|conn| conn.execute_batch(
            "CREATE TRIGGER reject_delivery BEFORE INSERT ON push_deliveries BEGIN SELECT RAISE(ABORT, 'disk failure fixture'); END;"
        )).await.unwrap();
        let now = Utc::now();
        assert!(
            store
                .accept_event("src_1", "d1", &comment("c1"), now)
                .await
                .is_err()
        );
        store
            .connection
            .call(|conn| conn.execute_batch("DROP TRIGGER reject_delivery"))
            .await
            .unwrap();
        assert_eq!(
            store
                .accept_event("src_1", "d2", &comment("c1"), now)
                .await
                .unwrap(),
            1
        );
    }

    #[tokio::test]
    async fn claims_do_not_overlap_and_retries_wait_until_due() {
        let store = store().await;
        bind(&store, "ins_1", "space", None, &PushPreferences::default()).await;
        let now = Utc::now();
        store
            .accept_event("src_1", "d1", &comment("c1"), now)
            .await
            .unwrap();
        store
            .accept_event("src_1", "d2", &comment("c2"), now)
            .await
            .unwrap();
        let (first, second) = tokio::join!(
            store.claim_deliveries(1, now),
            store.claim_deliveries(1, now)
        );
        let (first, second) = (first.unwrap(), second.unwrap());
        assert_eq!((first.len(), second.len()), (1, 1));
        assert_ne!(first[0].id, second[0].id);
        assert_eq!((first[0].attempt, second[0].attempt), (1, 1));
        assert!(store.claim_deliveries(25, now).await.unwrap().is_empty());
        store
            .complete_delivery(&first[0].id, Some("apns-id"), now)
            .await
            .unwrap();
        let due = now + TimeDelta::seconds(30);
        store
            .retry_delivery(&second[0].id, "429", due, now)
            .await
            .unwrap();
        assert!(
            store
                .claim_deliveries(25, due - TimeDelta::milliseconds(1))
                .await
                .unwrap()
                .is_empty()
        );
        let retried = store.claim_deliveries(25, due).await.unwrap();
        assert_eq!(retried.len(), 1);
        assert_eq!(retried[0].attempt, 2);
        store
            .fail_delivery(&retried[0].id, "BadDeviceToken", due)
            .await
            .unwrap();
        assert!(
            store
                .claim_deliveries(25, due + TimeDelta::hours(1))
                .await
                .unwrap()
                .is_empty()
        );
    }

    #[tokio::test]
    async fn restart_preserves_bindings_and_resumes_interrupted_deliveries() {
        let path =
            std::env::temp_dir().join(format!("push-relay-{}.sqlite3", uuid::Uuid::new_v4()));
        let path_str = path.to_str().unwrap();
        let store = Store::open(path_str).await.unwrap();
        store.migrate().await.unwrap();
        store
            .create_source(
                "src_1",
                "https://example.com",
                Some("Site"),
                "encrypted-source",
            )
            .await
            .unwrap();
        bind(
            &store,
            "ins_1",
            "space",
            Some("reader1"),
            &PushPreferences::default(),
        )
        .await;
        let now = Utc::now();
        store
            .accept_event("src_1", "d1", &comment("c1"), now)
            .await
            .unwrap();
        let claimed = store.claim_deliveries(25, now).await.unwrap();
        assert_eq!(claimed.len(), 1);
        store.connection.close().await.unwrap();
        let store = Store::open(path_str).await.unwrap();
        store.migrate().await.unwrap();
        store.migrate().await.unwrap();
        assert!(
            store
                .find_binding_for_installation("ins_1", "bnd_ins_1")
                .await
                .unwrap()
                .is_some()
        );
        assert_eq!(
            store
                .find_source("src_1")
                .await
                .unwrap()
                .unwrap()
                .secret_ciphertext,
            "encrypted-source"
        );
        assert!(store.claim_deliveries(25, now).await.unwrap().is_empty());
        store.resume_deliveries().await.unwrap();
        let resumed = store.claim_deliveries(25, now).await.unwrap();
        assert_eq!(resumed.len(), 1);
        assert_eq!(resumed[0].id, claimed[0].id);
        assert_eq!(resumed[0].attempt, 2);
        assert_eq!(resumed[0].token_ciphertext, "encrypted-token");
        store.connection.close().await.unwrap();
        std::fs::remove_file(path).unwrap();
    }
}
