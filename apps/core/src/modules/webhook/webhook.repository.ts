import { Inject, Injectable } from '@nestjs/common'
import { desc, eq, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { webhookEvents, webhooks } from '~/database/schema'
import {
  BaseRepository,
  type PaginationResult,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

export interface WebhookRow {
  id: EntityId
  payloadUrl: string
  events: string[]
  enabled: boolean
  scope: number | null
  /** Timestamp recorded at creation; named `timestamp` in the legacy schema. */
  timestamp: Date | null
}

export interface WebhookEventRow {
  id: EntityId
  hookId: EntityId
  event: string | null
  headers: Record<string, unknown> | null
  payload: unknown
  response: unknown
  success: boolean | null
  status: number
  timestamp: Date | null
}

const mapHook = (row: typeof webhooks.$inferSelect): WebhookRow => ({
  id: toEntityId(row.id) as EntityId,
  payloadUrl: row.payloadUrl,
  events: row.events,
  enabled: row.enabled,
  scope: row.scope,
  timestamp: row.timestamp,
})

const mapEvent = (row: typeof webhookEvents.$inferSelect): WebhookEventRow => ({
  id: toEntityId(row.id) as EntityId,
  hookId: toEntityId(row.hookId) as EntityId,
  event: row.event,
  headers: row.headers,
  payload: row.payload,
  response: row.response,
  success: row.success,
  status: row.status,
  timestamp: row.timestamp,
})

@Injectable()
export class WebhookRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async findAll(): Promise<WebhookRow[]> {
    const rows = await this.db
      .select()
      .from(webhooks)
      .orderBy(desc(webhooks.timestamp))
    return rows.map(mapHook)
  }

  async findEnabled(): Promise<Array<WebhookRow & { secret: string }>> {
    const rows = await this.db
      .select()
      .from(webhooks)
      .where(eq(webhooks.enabled, true))
    return rows.map((r) => ({ ...mapHook(r), secret: r.secret }))
  }

  async findById(
    id: EntityId | string,
  ): Promise<(WebhookRow & { secret: string }) | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .select()
      .from(webhooks)
      .where(eq(webhooks.id, idBig))
      .limit(1)
    if (!row) return null
    return { ...mapHook(row), secret: row.secret }
  }

  async create(input: {
    payloadUrl: string
    events: string[]
    secret: string
    enabled?: boolean
    scope?: number | null
  }): Promise<WebhookRow> {
    const id = this.snowflake.nextBigInt()
    const [row] = await this.db
      .insert(webhooks)
      .values({
        id,
        payloadUrl: input.payloadUrl,
        events: input.events,
        secret: input.secret,
        enabled: input.enabled ?? true,
        scope: input.scope ?? null,
        timestamp: new Date(),
      })
      .returning()
    return mapHook(row)
  }

  async update(
    id: EntityId | string,
    patch: Partial<{
      payloadUrl: string
      events: string[]
      secret: string
      enabled: boolean
      scope: number | null
    }>,
  ): Promise<WebhookRow | null> {
    const idBig = parseEntityId(id)
    const update: Partial<typeof webhooks.$inferInsert> = {}
    if (patch.payloadUrl !== undefined) update.payloadUrl = patch.payloadUrl
    if (patch.events !== undefined) update.events = patch.events
    if (patch.secret !== undefined) update.secret = patch.secret
    if (patch.enabled !== undefined) update.enabled = patch.enabled
    if (patch.scope !== undefined) update.scope = patch.scope
    const [row] = await this.db
      .update(webhooks)
      .set(update)
      .where(eq(webhooks.id, idBig))
      .returning()
    return row ? mapHook(row) : null
  }

  async deleteById(id: EntityId | string): Promise<WebhookRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .delete(webhooks)
      .where(eq(webhooks.id, idBig))
      .returning()
    return row ? mapHook(row) : null
  }

  async logEvent(input: {
    hookId: EntityId | string
    event: string | null
    headers?: Record<string, unknown> | null
    payload?: unknown
    response?: unknown
    success?: boolean | null
    status?: number
  }): Promise<WebhookEventRow> {
    const id = this.snowflake.nextBigInt()
    const [row] = await this.db
      .insert(webhookEvents)
      .values({
        id,
        hookId: parseEntityId(input.hookId),
        event: input.event,
        headers: input.headers ?? null,
        payload: input.payload ?? null,
        response: input.response ?? null,
        success: input.success ?? null,
        status: input.status ?? 0,
        timestamp: new Date(),
      })
      .returning()
    return mapEvent(row)
  }

  async updateEvent(
    id: EntityId | string,
    patch: Partial<{
      response: unknown
      success: boolean | null
      status: number
    }>,
  ): Promise<WebhookEventRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .update(webhookEvents)
      .set(patch)
      .where(eq(webhookEvents.id, idBig))
      .returning()
    return row ? mapEvent(row) : null
  }

  async findEventById(id: EntityId | string): Promise<WebhookEventRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.id, idBig))
      .limit(1)
    return row ? mapEvent(row) : null
  }

  async listEvents(
    hookId: EntityId | string,
    page = 1,
    size = 20,
  ): Promise<PaginationResult<WebhookEventRow>> {
    const idBig = parseEntityId(hookId)
    page = Math.max(1, page)
    size = Math.min(100, Math.max(1, size))
    const offset = (page - 1) * size
    const where = eq(webhookEvents.hookId, idBig)
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(webhookEvents)
        .where(where)
        .orderBy(desc(webhookEvents.timestamp))
        .limit(size)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(webhookEvents)
        .where(where),
    ])
    return {
      data: rows.map(mapEvent),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async deleteEventsByHookId(hookId: EntityId | string): Promise<number> {
    const result = await this.db
      .delete(webhookEvents)
      .where(eq(webhookEvents.hookId, parseEntityId(hookId)))
      .returning({ id: webhookEvents.id })
    return result.length
  }
}
