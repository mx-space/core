import type { Pool, PoolClient } from 'pg'

import type {
  ActivationTicketRecord,
  DeliveryRecord,
  InstallationRecord,
  PushRelayStore,
  SourceRecord,
} from './types.js'

const withTransaction = async <T>(
  pool: Pool,
  callback: (client: PoolClient) => Promise<T>,
) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export class PostgresPushRelayStore implements PushRelayStore {
  constructor(private readonly pool: Pool) {}

  async createInstallation(
    input: Parameters<PushRelayStore['createInstallation']>[0],
  ) {
    await this.pool.query(
      `INSERT INTO push_installations
       (id, app_id, apns_environment, token_hash, token_ciphertext, secret_hash)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        input.id,
        input.appId,
        input.apnsEnvironment,
        input.tokenHash,
        input.tokenCiphertext,
        input.secretHash,
      ],
    )
  }

  async findInstallation(id: string): Promise<InstallationRecord | null> {
    const result = await this.pool.query<{
      id: string
      app_id: string
      apns_environment: InstallationRecord['apnsEnvironment']
      token_ciphertext: string
      secret_hash: string
      revoked_at: Date | null
    }>(
      `SELECT id, app_id, apns_environment, token_ciphertext, secret_hash, revoked_at
       FROM push_installations WHERE id = $1`,
      [id],
    )
    const row = result.rows[0]
    return row
      ? {
          id: row.id,
          appId: row.app_id,
          apnsEnvironment: row.apns_environment,
          tokenCiphertext: row.token_ciphertext,
          secretHash: row.secret_hash,
          revokedAt: row.revoked_at,
        }
      : null
  }

  async updateInstallationToken(
    input: Parameters<PushRelayStore['updateInstallationToken']>[0],
  ) {
    const result = await this.pool.query(
      `UPDATE push_installations
       SET apns_environment = $2, token_hash = $3, token_ciphertext = $4,
           revoked_at = NULL, updated_at = now()
       WHERE id = $1`,
      [input.id, input.apnsEnvironment, input.tokenHash, input.tokenCiphertext],
    )
    return result.rowCount === 1
  }

  async createActivationTicket(
    input: Parameters<PushRelayStore['createActivationTicket']>[0],
  ) {
    await this.pool.query(
      `INSERT INTO push_activation_tickets
       (id, ticket_hash, installation_id, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [input.id, input.ticketHash, input.installationId, input.expiresAt],
    )
  }

  async claimActivationTicket(
    ticketHash: string,
    now: Date,
  ): Promise<ActivationTicketRecord | null> {
    return withTransaction(this.pool, async (client) => {
      const result = await client.query<{
        installation_id: string
        expires_at: Date
        claimed_at: Date | null
      }>(
        `SELECT installation_id, expires_at, claimed_at
         FROM push_activation_tickets
         WHERE ticket_hash = $1 FOR UPDATE`,
        [ticketHash],
      )
      const row = result.rows[0]
      if (!row || row.claimed_at || row.expires_at <= now) return null
      await client.query(
        `UPDATE push_activation_tickets SET claimed_at = $2 WHERE ticket_hash = $1`,
        [ticketHash, now],
      )
      return {
        installationId: row.installation_id,
        expiresAt: row.expires_at,
        claimedAt: now,
      }
    })
  }

  async createSource(input: Parameters<PushRelayStore['createSource']>[0]) {
    await this.pool.query(
      `INSERT INTO push_sources (id, origin, label, secret_ciphertext)
       VALUES ($1, $2, $3, $4)`,
      [input.id, input.origin, input.label, input.secretCiphertext],
    )
  }

  async findSource(id: string): Promise<SourceRecord | null> {
    const result = await this.pool.query<{
      id: string
      secret_ciphertext: string
      origin: string
      revoked_at: Date | null
    }>(
      `SELECT id, secret_ciphertext, origin, revoked_at
       FROM push_sources WHERE id = $1`,
      [id],
    )
    const row = result.rows[0]
    return row
      ? {
          id: row.id,
          secretCiphertext: row.secret_ciphertext,
          origin: row.origin,
          revokedAt: row.revoked_at,
        }
      : null
  }

  async createBinding(input: Parameters<PushRelayStore['createBinding']>[0]) {
    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO push_bindings (id, source_id, installation_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (source_id, installation_id)
       DO UPDATE SET revoked_at = NULL, updated_at = now()
       RETURNING id`,
      [input.id, input.sourceId, input.installationId],
    )
    return result.rows[0]!.id
  }

  async revokeBinding(sourceId: string, bindingId: string, now: Date) {
    const result = await this.pool.query(
      `UPDATE push_bindings SET revoked_at = $3, updated_at = $3
       WHERE source_id = $1 AND id = $2 AND revoked_at IS NULL`,
      [sourceId, bindingId, now],
    )
    return result.rowCount === 1
  }

  async acceptEvent(input: Parameters<PushRelayStore['acceptEvent']>[0]) {
    return withTransaction(this.pool, async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO push_events
         (id, source_id, delivery_id, event_type, subject, payload, event_time, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (source_id, id) DO NOTHING
         RETURNING id`,
        [
          input.id,
          input.sourceId,
          input.deliveryId,
          input.event.type,
          input.event.subject,
          input.event,
          new Date(input.event.time),
          input.now,
        ],
      )
      if (inserted.rowCount === 0) {
        const existing = await client.query<{ count: string }>(
          `SELECT count(*)::text AS count FROM push_deliveries
           WHERE source_id = $1 AND event_id = $2`,
          [input.sourceId, input.id],
        )
        return {
          accepted: false,
          deliveries: Number(existing.rows[0]?.count ?? 0),
        }
      }

      const deliveries = await client.query(
        `INSERT INTO push_deliveries
         (id, source_id, event_id, binding_id, installation_id, next_attempt_at)
         SELECT 'dlv_' || encode(gen_random_bytes(18), 'hex'), b.source_id, $1,
                b.id, b.installation_id, $3
         FROM push_bindings b
         JOIN push_installations i ON i.id = b.installation_id
         WHERE b.source_id = $2 AND b.revoked_at IS NULL AND i.revoked_at IS NULL`,
        [input.id, input.sourceId, input.now],
      )
      return { accepted: true, deliveries: deliveries.rowCount ?? 0 }
    })
  }

  async claimDeliveries(limit: number, now: Date): Promise<DeliveryRecord[]> {
    return withTransaction(this.pool, async (client) => {
      const result = await client.query<{
        id: string
        event_id: string
        installation_id: string
        app_id: string
        apns_environment: DeliveryRecord['apnsEnvironment']
        token_ciphertext: string
        payload: DeliveryRecord['event']
        attempt: number
      }>(
        `WITH candidates AS (
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
         SELECT c.id, c.event_id, c.installation_id, i.app_id,
                i.apns_environment, i.token_ciphertext, e.payload, c.attempt
         FROM claimed c
         JOIN push_installations i ON i.id = c.installation_id
         JOIN push_events e ON e.source_id = c.source_id AND e.id = c.event_id`,
        [now, limit],
      )
      return result.rows.map((row) => ({
        id: row.id,
        eventId: row.event_id,
        installationId: row.installation_id,
        appId: row.app_id,
        apnsEnvironment: row.apns_environment,
        tokenCiphertext: row.token_ciphertext,
        event: row.payload,
        attempt: row.attempt,
      }))
    })
  }

  async completeDelivery(id: string, apnsId: string | null, now: Date) {
    await this.pool.query(
      `UPDATE push_deliveries SET status = 'delivered', apns_id = $2,
       delivered_at = $3, updated_at = $3 WHERE id = $1`,
      [id, apnsId, now],
    )
  }

  async retryDelivery(
    id: string,
    error: string,
    nextAttemptAt: Date,
    now: Date,
  ) {
    await this.pool.query(
      `UPDATE push_deliveries SET status = 'retrying', last_error = $2,
       next_attempt_at = $3, updated_at = $4 WHERE id = $1`,
      [id, error, nextAttemptAt, now],
    )
  }

  async failDelivery(id: string, error: string, now: Date) {
    await this.pool.query(
      `UPDATE push_deliveries SET status = 'failed', last_error = $2,
       updated_at = $3 WHERE id = $1`,
      [id, error, now],
    )
  }

  async revokeInstallation(id: string, now: Date) {
    await this.pool.query(
      `UPDATE push_installations SET revoked_at = $2, updated_at = $2 WHERE id = $1`,
      [id, now],
    )
  }
}
