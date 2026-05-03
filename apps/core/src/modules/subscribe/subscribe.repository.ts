import { Inject, Injectable } from '@nestjs/common'
import { desc, eq, inArray, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { subscribes } from '~/database/schema'
import {
  BaseRepository,
  type PaginationResult,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

export interface SubscribeRow {
  id: EntityId
  email: string
  cancelToken: string
  subscribe: number
  verified: boolean
  createdAt: Date
}

const mapRow = (row: typeof subscribes.$inferSelect): SubscribeRow => ({
  id: toEntityId(row.id) as EntityId,
  email: row.email,
  cancelToken: row.cancelToken,
  subscribe: row.subscribe,
  verified: row.verified,
  createdAt: row.createdAt,
})

@Injectable()
export class SubscribeRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async list(page = 1, size = 10): Promise<PaginationResult<SubscribeRow>> {
    page = Math.max(1, page)
    size = Math.min(50, Math.max(1, size))
    const offset = (page - 1) * size
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(subscribes)
        .orderBy(desc(subscribes.createdAt))
        .limit(size)
        .offset(offset),
      this.db.select({ count: sql<number>`count(*)::int` }).from(subscribes),
    ])
    return {
      data: rows.map(mapRow),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async findAll(): Promise<SubscribeRow[]> {
    const rows = await this.db
      .select()
      .from(subscribes)
      .orderBy(subscribes.createdAt)
    return rows.map(mapRow)
  }

  async findById(id: EntityId | string): Promise<SubscribeRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .select()
      .from(subscribes)
      .where(eq(subscribes.id, idBig))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async findByEmail(email: string): Promise<SubscribeRow | null> {
    const [row] = await this.db
      .select()
      .from(subscribes)
      .where(eq(subscribes.email, email))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async findByCancelToken(token: string): Promise<SubscribeRow | null> {
    const [row] = await this.db
      .select()
      .from(subscribes)
      .where(eq(subscribes.cancelToken, token))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async create(input: {
    email: string
    cancelToken: string
    subscribe: number
    verified?: boolean
  }): Promise<SubscribeRow> {
    const id = this.snowflake.nextBigInt()
    const [row] = await this.db
      .insert(subscribes)
      .values({
        id,
        email: input.email,
        cancelToken: input.cancelToken,
        subscribe: input.subscribe,
        verified: input.verified ?? false,
      })
      .returning()
    return mapRow(row)
  }

  async update(
    id: EntityId | string,
    patch: Partial<{
      subscribe: number
      verified: boolean
      cancelToken: string
    }>,
  ): Promise<SubscribeRow | null> {
    const idBig = parseEntityId(id)
    const update: Partial<typeof subscribes.$inferInsert> = {}
    if (patch.subscribe !== undefined) update.subscribe = patch.subscribe
    if (patch.verified !== undefined) update.verified = patch.verified
    if (patch.cancelToken !== undefined) update.cancelToken = patch.cancelToken
    const [row] = await this.db
      .update(subscribes)
      .set(update)
      .where(eq(subscribes.id, idBig))
      .returning()
    return row ? mapRow(row) : null
  }

  async deleteById(id: EntityId | string): Promise<SubscribeRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .delete(subscribes)
      .where(eq(subscribes.id, idBig))
      .returning()
    return row ? mapRow(row) : null
  }

  async updateByEmail(
    email: string,
    patch: Partial<{
      subscribe: number
      verified: boolean
      cancelToken: string
    }>,
  ): Promise<SubscribeRow | null> {
    const update: Partial<typeof subscribes.$inferInsert> = {}
    if (patch.subscribe !== undefined) update.subscribe = patch.subscribe
    if (patch.verified !== undefined) update.verified = patch.verified
    if (patch.cancelToken !== undefined) update.cancelToken = patch.cancelToken
    const [row] = await this.db
      .update(subscribes)
      .set(update)
      .where(eq(subscribes.email, email))
      .returning()
    return row ? mapRow(row) : null
  }

  async deleteByEmail(email: string): Promise<SubscribeRow | null> {
    const [row] = await this.db
      .delete(subscribes)
      .where(eq(subscribes.email, email))
      .returning()
    return row ? mapRow(row) : null
  }

  async deleteByEmails(emails: string[]): Promise<number> {
    if (emails.length === 0) return 0
    const rows = await this.db
      .delete(subscribes)
      .where(inArray(subscribes.email, emails))
      .returning({ id: subscribes.id })
    return rows.length
  }

  async deleteAll(): Promise<number> {
    const rows = await this.db
      .delete(subscribes)
      .returning({ id: subscribes.id })
    return rows.length
  }

  async count(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(subscribes)
    return Number(row?.count ?? 0)
  }
}
