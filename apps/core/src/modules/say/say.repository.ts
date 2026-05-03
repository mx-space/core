import { Inject, Injectable } from '@nestjs/common'
import { desc, eq, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { says } from '~/database/schema'
import {
  BaseRepository,
  type PaginationResult,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

export interface SayRow {
  id: EntityId
  text: string
  source: string | null
  author: string | null
  createdAt: Date
}

export interface SayCreateInput {
  text: string
  source?: string | null
  author?: string | null
}

export type SayPatchInput = Partial<SayCreateInput>

const mapRow = (row: typeof says.$inferSelect): SayRow => ({
  id: toEntityId(row.id) as EntityId,
  text: row.text,
  source: row.source,
  author: row.author,
  createdAt: row.createdAt,
})

@Injectable()
export class SayRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async list(page = 1, size = 10): Promise<PaginationResult<SayRow>> {
    page = Math.max(1, page)
    size = Math.min(50, Math.max(1, size))
    const offset = (page - 1) * size
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(says)
        .orderBy(desc(says.createdAt))
        .limit(size)
        .offset(offset),
      this.db.select({ count: sql<number>`count(*)::int` }).from(says),
    ])
    return {
      data: rows.map(mapRow),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async findRecent(size: number): Promise<SayRow[]> {
    size = Math.min(50, Math.max(1, size))
    const rows = await this.db
      .select()
      .from(says)
      .orderBy(desc(says.createdAt))
      .limit(size)
    return rows.map(mapRow)
  }

  async findAll(): Promise<SayRow[]> {
    const rows = await this.db.select().from(says).orderBy(desc(says.createdAt))
    return rows.map(mapRow)
  }

  async findById(id: EntityId | string): Promise<SayRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .select()
      .from(says)
      .where(eq(says.id, idBig))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async create(input: SayCreateInput): Promise<SayRow> {
    const id = this.snowflake.nextBigInt()
    const [row] = await this.db
      .insert(says)
      .values({
        id,
        text: input.text,
        source: input.source ?? null,
        author: input.author ?? null,
      })
      .returning()
    return mapRow(row)
  }

  async update(
    id: EntityId | string,
    patch: SayPatchInput,
  ): Promise<SayRow | null> {
    const idBig = parseEntityId(id)
    const update: Partial<typeof says.$inferInsert> = {}
    if (patch.text !== undefined) update.text = patch.text
    if (patch.source !== undefined) update.source = patch.source
    if (patch.author !== undefined) update.author = patch.author
    const [row] = await this.db
      .update(says)
      .set(update)
      .where(eq(says.id, idBig))
      .returning()
    return row ? mapRow(row) : null
  }

  async deleteById(id: EntityId | string): Promise<SayRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .delete(says)
      .where(eq(says.id, idBig))
      .returning()
    return row ? mapRow(row) : null
  }

  async count(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(says)
    return Number(row?.count ?? 0)
  }
}
