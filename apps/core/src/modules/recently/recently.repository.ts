import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, type SQL, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { recentlies } from '~/database/schema'
import {
  BaseRepository,
  type PaginationResult,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

export type RecentlyRefType = 'Post' | 'Note' | 'Page' | 'Recently' | null

export interface RecentlyRow {
  id: EntityId
  content: string
  type: string
  metadata: Record<string, unknown> | null
  refType: RecentlyRefType
  refId: EntityId | null
  commentsIndex: number
  allowComment: boolean
  up: number
  down: number
  createdAt: Date
  modifiedAt: Date | null
}

export interface RecentlyCreateInput {
  content?: string
  type: string
  metadata?: Record<string, unknown> | null
  refType?: RecentlyRefType
  refId?: EntityId | string | null
  allowComment?: boolean
}

export type RecentlyPatchInput = Partial<RecentlyCreateInput> & {
  modifiedAt?: Date | null
  up?: number
  down?: number
  commentsIndex?: number
}

const mapRow = (row: typeof recentlies.$inferSelect): RecentlyRow => ({
  id: toEntityId(row.id) as EntityId,
  content: row.content,
  type: row.type,
  metadata: row.metadata,
  refType: (row.refType ?? null) as RecentlyRefType,
  refId: row.refId ? (toEntityId(row.refId) as EntityId) : null,
  commentsIndex: row.commentsIndex,
  allowComment: row.allowComment,
  up: row.up,
  down: row.down,
  createdAt: row.createdAt,
  modifiedAt: row.modifiedAt,
})

@Injectable()
export class RecentlyRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async list(page = 1, size = 10): Promise<PaginationResult<RecentlyRow>> {
    page = Math.max(1, page)
    size = Math.min(50, Math.max(1, size))
    const offset = (page - 1) * size
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(recentlies)
        .orderBy(desc(recentlies.createdAt))
        .limit(size)
        .offset(offset),
      this.db.select({ count: sql<number>`count(*)::int` }).from(recentlies),
    ])
    return {
      data: rows.map(mapRow),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async findById(id: EntityId | string): Promise<RecentlyRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .select()
      .from(recentlies)
      .where(eq(recentlies.id, idBig))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async findByRef(
    refType: NonNullable<RecentlyRefType>,
    refId: EntityId | string,
  ): Promise<RecentlyRow[]> {
    const where: SQL = and(
      eq(recentlies.refType, refType),
      eq(recentlies.refId, parseEntityId(refId)),
    )!
    const rows = await this.db.select().from(recentlies).where(where)
    return rows.map(mapRow)
  }

  async create(input: RecentlyCreateInput): Promise<RecentlyRow> {
    const id = this.snowflake.nextBigInt()
    const [row] = await this.db
      .insert(recentlies)
      .values({
        id,
        content: input.content ?? '',
        type: input.type,
        metadata: input.metadata ?? null,
        refType: input.refType ?? null,
        refId: input.refId ? parseEntityId(input.refId) : null,
        allowComment: input.allowComment ?? true,
      })
      .returning()
    return mapRow(row)
  }

  async update(
    id: EntityId | string,
    patch: RecentlyPatchInput,
  ): Promise<RecentlyRow | null> {
    const idBig = parseEntityId(id)
    const update: Partial<typeof recentlies.$inferInsert> = {
      modifiedAt: patch.modifiedAt ?? new Date(),
    }
    if (patch.content !== undefined) update.content = patch.content
    if (patch.type !== undefined) update.type = patch.type
    if (patch.metadata !== undefined) update.metadata = patch.metadata
    if (patch.refType !== undefined) update.refType = patch.refType
    if (patch.refId !== undefined)
      update.refId = patch.refId ? parseEntityId(patch.refId) : null
    if (patch.allowComment !== undefined)
      update.allowComment = patch.allowComment
    if (patch.up !== undefined) update.up = patch.up
    if (patch.down !== undefined) update.down = patch.down
    if (patch.commentsIndex !== undefined)
      update.commentsIndex = patch.commentsIndex
    const [row] = await this.db
      .update(recentlies)
      .set(update)
      .where(eq(recentlies.id, idBig))
      .returning()
    return row ? mapRow(row) : null
  }

  async deleteById(id: EntityId | string): Promise<RecentlyRow | null> {
    const idBig = parseEntityId(id)
    const [row] = await this.db
      .delete(recentlies)
      .where(eq(recentlies.id, idBig))
      .returning()
    return row ? mapRow(row) : null
  }

  async incrementUp(id: EntityId | string, by = 1): Promise<void> {
    const idBig = parseEntityId(id)
    await this.db
      .update(recentlies)
      .set({ up: sql`${recentlies.up} + ${by}` })
      .where(eq(recentlies.id, idBig))
  }

  async incrementDown(id: EntityId | string, by = 1): Promise<void> {
    const idBig = parseEntityId(id)
    await this.db
      .update(recentlies)
      .set({ down: sql`${recentlies.down} + ${by}` })
      .where(eq(recentlies.id, idBig))
  }

  async count(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(recentlies)
    return Number(row?.count ?? 0)
  }

  async findRecent(size: number): Promise<RecentlyRow[]> {
    const rows = await this.db
      .select()
      .from(recentlies)
      .orderBy(desc(recentlies.createdAt))
      .limit(Math.max(1, size))
    return rows.map(mapRow)
  }

  async findArchiveBuckets(): Promise<
    Array<{ year: number; month: number; count: number }>
  > {
    const rows = await this.db
      .select({
        year: sql<number>`extract(year from ${recentlies.createdAt})::int`,
        month: sql<number>`extract(month from ${recentlies.createdAt})::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(recentlies)
      .groupBy(
        sql`extract(year from ${recentlies.createdAt})`,
        sql`extract(month from ${recentlies.createdAt})`,
      )
      .orderBy(
        sql`extract(year from ${recentlies.createdAt}) desc`,
        sql`extract(month from ${recentlies.createdAt}) desc`,
      )
    return rows.map((r) => ({
      year: Number(r.year),
      month: Number(r.month),
      count: Number(r.count ?? 0),
    }))
  }
}
