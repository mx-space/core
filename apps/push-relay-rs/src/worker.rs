use std::time::Duration;

use chrono::{DateTime, TimeDelta, Utc};
use futures_util::future::join_all;
use tokio::sync::watch;
use tokio::time::MissedTickBehavior;

use crate::apns::ApnsProvider;
use crate::crypto::DataVault;
use crate::store::{DeliveryRecord, Store};

const BATCH_SIZE: i64 = 25;
const MAX_ATTEMPTS: i32 = 8;

fn retry_at(attempt: i32, from: DateTime<Utc>) -> DateTime<Utc> {
    let delay_seconds = (15_i64 << attempt.clamp(0, 30)).min(60 * 60);
    from + TimeDelta::seconds(delay_seconds)
}

pub struct DeliveryWorker {
    store: Store,
    provider: ApnsProvider,
    vault: DataVault,
}

impl DeliveryWorker {
    pub fn new(store: Store, provider: ApnsProvider, vault: DataVault) -> Self {
        Self {
            store,
            provider,
            vault,
        }
    }

    pub async fn run(self, mut shutdown: watch::Receiver<bool>) {
        let mut interval = tokio::time::interval(Duration::from_secs(1));
        interval.set_missed_tick_behavior(MissedTickBehavior::Delay);
        loop {
            tokio::select! {
                _ = interval.tick() => self.tick().await,
                _ = shutdown.changed() => break,
            }
        }
    }

    async fn tick(&self) {
        match self.store.claim_deliveries(BATCH_SIZE, Utc::now()).await {
            Ok(deliveries) => {
                join_all(deliveries.iter().map(|delivery| self.process(delivery))).await;
            }
            Err(error) => eprintln!("Failed to claim deliveries: {error}"),
        }
    }

    async fn process(&self, delivery: &DeliveryRecord) {
        let Err(message) = self.deliver(delivery).await else {
            return;
        };
        let failed_at = Utc::now();
        let outcome = if delivery.attempt < MAX_ATTEMPTS {
            self.store
                .retry_delivery(
                    &delivery.id,
                    &message,
                    retry_at(delivery.attempt, failed_at),
                    failed_at,
                )
                .await
        } else {
            self.store
                .fail_delivery(&delivery.id, &message, failed_at)
                .await
        };
        if let Err(error) = outcome {
            eprintln!("Failed to record delivery {} failure: {error}", delivery.id);
        }
    }

    async fn deliver(&self, delivery: &DeliveryRecord) -> Result<(), String> {
        let event = delivery.event.as_ref().map_err(Clone::clone)?;
        let device_token = self.vault.decrypt(&delivery.token_ciphertext)?;
        let result = self
            .provider
            .send(
                &delivery.app_id,
                delivery.apns_environment,
                &device_token,
                event,
            )
            .await?;
        let completed_at = Utc::now();
        let store_error = |error: crate::store::DbError| error.0;

        if (200..300).contains(&result.status) {
            return self
                .store
                .complete_delivery(&delivery.id, result.apns_id.as_deref(), completed_at)
                .await
                .map_err(store_error);
        }

        let reason = result.reason.as_deref();
        let message = format!(
            "{}:{}",
            result.status,
            reason.unwrap_or("APNs rejected delivery")
        );
        if result.status == 410 || matches!(reason, Some("BadDeviceToken" | "Unregistered")) {
            self.store
                .revoke_installation(&delivery.installation_id, completed_at)
                .await
                .map_err(store_error)?;
            self.store
                .fail_delivery(&delivery.id, &message, completed_at)
                .await
                .map_err(store_error)
        } else if (result.status == 429 || result.status >= 500) && delivery.attempt < MAX_ATTEMPTS
        {
            self.store
                .retry_delivery(
                    &delivery.id,
                    &message,
                    retry_at(delivery.attempt, completed_at),
                    completed_at,
                )
                .await
                .map_err(store_error)
        } else {
            self.store
                .fail_delivery(&delivery.id, &message, completed_at)
                .await
                .map_err(store_error)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn retry_backoff() {
        let now = Utc::now();
        assert_eq!(retry_at(1, now) - now, TimeDelta::seconds(30));
        assert_eq!(retry_at(7, now) - now, TimeDelta::seconds(1920));
        assert_eq!(retry_at(8, now) - now, TimeDelta::seconds(3600));
    }
}
