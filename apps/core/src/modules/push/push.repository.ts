import { randomUUID } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import {
  pushRelayBindings,
  pushRelayDeliveries,
  pushRelaySources,
} from '~/database/schema'
import { BaseRepository } from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'

import type {
  PushRelayBindingRow,
  PushRelayDeliveryRow,
  PushRelaySourceRow,
} from './push.types'

const mapSource = (
  row: typeof pushRelaySources.$inferSelect,
): PushRelaySourceRow => ({
  id: row.id,
  relayUrl: row.relayUrl,
  remoteSourceId: row.remoteSourceId,
  sourceSecret: row.sourceSecret,
  eventEndpoint: row.eventEndpoint,
  enabled: row.enabled,
})

const mapBinding = (
  binding: typeof pushRelayBindings.$inferSelect,
  source: typeof pushRelaySources.$inferSelect,
): PushRelayBindingRow => ({
  id: binding.id,
  sourceId: binding.sourceId,
  remoteBindingId: binding.remoteBindingId,
  installationId: binding.installationId,
  readerId: binding.ownerId,
  relayUrl: source.relayUrl,
  revokedAt: binding.revokedAt,
  source: mapSource(source),
})

@Injectable()
export class PushRepository extends BaseRepository {
  constructor(@Inject(PG_DB_TOKEN) db: AppDatabase) {
    super(db)
  }

  async findSourceByRelayUrl(relayUrl: string) {
    const [row] = await this.db
      .select()
      .from(pushRelaySources)
      .where(eq(pushRelaySources.relayUrl, relayUrl))
      .limit(1)
    return row ? mapSource(row) : null
  }

  async listEnabledSources() {
    const rows = await this.db
      .selectDistinct({ source: pushRelaySources })
      .from(pushRelaySources)
      .innerJoin(
        pushRelayBindings,
        eq(pushRelayBindings.sourceId, pushRelaySources.id),
      )
      .where(
        and(
          eq(pushRelaySources.enabled, true),
          isNull(pushRelayBindings.revokedAt),
        ),
      )
    return rows.map((row) => mapSource(row.source))
  }

  async saveActivation(input: {
    readerId: string | null
    relayUrl: string
    remoteSourceId: string
    sourceSecret: string | null
    eventEndpoint: string
    remoteBindingId: string
    installationId: string
  }): Promise<PushRelayBindingRow> {
    return this.db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(pushRelaySources)
        .where(eq(pushRelaySources.relayUrl, input.relayUrl))
        .limit(1)
      let source = existing[0]
      if (!source) {
        if (!input.sourceSecret)
          throw new Error('Relay omitted a new source secret')
        const inserted = await tx
          .insert(pushRelaySources)
          .values({
            id: `src_${randomUUID()}`,
            relayUrl: input.relayUrl,
            remoteSourceId: input.remoteSourceId,
            sourceSecret: input.sourceSecret,
            eventEndpoint: input.eventEndpoint,
            enabled: true,
          })
          .returning()
        source = inserted[0]
      }
      if (!source) throw new Error('Unable to persist Push Relay source')
      if (source.remoteSourceId !== input.remoteSourceId) {
        throw new Error('Push Relay source identity changed during activation')
      }

      const rows = await tx
        .insert(pushRelayBindings)
        .values({
          id: `bnd_${randomUUID()}`,
          sourceId: source.id,
          remoteBindingId: input.remoteBindingId,
          installationId: input.installationId,
          ownerId: input.readerId,
        })
        .onConflictDoUpdate({
          target: [
            pushRelayBindings.sourceId,
            pushRelayBindings.installationId,
          ],
          set: {
            remoteBindingId: input.remoteBindingId,
            ownerId: input.readerId,
            revokedAt: null,
            updatedAt: new Date(),
          },
        })
        .returning()
      const binding = rows[0]
      if (!binding) throw new Error('Unable to persist Push Relay binding')
      return mapBinding(binding, source)
    })
  }

  async enqueueDelivery(input: {
    sourceId: string
    event: PushRelayDeliveryRow['event']
    now: Date
  }) {
    const [row] = await this.db
      .insert(pushRelayDeliveries)
      .values({
        id: `dlv_${randomUUID()}`,
        sourceId: input.sourceId,
        eventId: input.event.id,
        eventType: input.event.type,
        subject: input.event.subject,
        payload: input.event,
        status: 'pending',
        nextAttemptAt: input.now,
      })
      .onConflictDoNothing({
        target: [pushRelayDeliveries.sourceId, pushRelayDeliveries.eventId],
      })
      .returning({ id: pushRelayDeliveries.id })
    return row?.id ?? null
  }

  async claimDueDeliveries(
    now: Date,
    limit = 20,
  ): Promise<PushRelayDeliveryRow[]> {
    const result = await this.db.execute<{
      id: string
      source_id: string
      relay_url: string
      remote_source_id: string
      source_secret: string
      event_endpoint: string
      enabled: boolean
      payload: PushRelayDeliveryRow['event']
      attempt: number
    }>(sql`
      WITH candidates AS (
        SELECT id FROM ${pushRelayDeliveries}
        WHERE (
          status IN ('pending', 'retrying') AND next_attempt_at <= ${now}
        ) OR (
          status = 'processing' AND updated_at < ${new Date(now.getTime() - 5 * 60 * 1000)}
        )
        ORDER BY next_attempt_at, created_at
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      ), claimed AS (
        UPDATE ${pushRelayDeliveries} d
        SET status = 'processing', attempt = attempt + 1, updated_at = ${now}
        FROM candidates c WHERE d.id = c.id
        RETURNING d.*
      )
      SELECT c.id, s.id AS source_id, s.relay_url, s.remote_source_id, s.source_secret,
             s.event_endpoint, s.enabled, c.payload, c.attempt
      FROM claimed c
      JOIN ${pushRelaySources} s ON s.id = c.source_id
      WHERE s.enabled = true
    `)
    return result.rows.map((row) => ({
      id: row.id,
      source: {
        id: row.source_id,
        relayUrl: row.relay_url,
        remoteSourceId: row.remote_source_id,
        sourceSecret: row.source_secret,
        eventEndpoint: row.event_endpoint,
        enabled: row.enabled,
      },
      event: row.payload,
      attempt: row.attempt,
    }))
  }

  async markDelivered(id: string, now: Date) {
    await this.db
      .update(pushRelayDeliveries)
      .set({
        status: 'delivered',
        deliveredAt: now,
        updatedAt: now,
        lastError: null,
      })
      .where(eq(pushRelayDeliveries.id, id))
  }

  async markRetry(id: string, error: string, nextAttemptAt: Date, now: Date) {
    await this.db
      .update(pushRelayDeliveries)
      .set({
        status: 'retrying',
        lastError: error,
        nextAttemptAt,
        updatedAt: now,
      })
      .where(eq(pushRelayDeliveries.id, id))
  }

  async markFailed(id: string, error: string, now: Date) {
    await this.db
      .update(pushRelayDeliveries)
      .set({ status: 'failed', lastError: error, updatedAt: now })
      .where(eq(pushRelayDeliveries.id, id))
  }
}
