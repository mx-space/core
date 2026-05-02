import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, gte, lte, type SQL, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { analyzes } from '~/database/schema'
import {
  BaseRepository,
  type PaginationResult,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

export interface AnalyzeRow {
  id: EntityId
  timestamp: Date
  ip: string | null
  ua: Record<string, unknown> | null
  country: string | null
  path: string | null
  referer: string | null
}

const mapRow = (row: typeof analyzes.$inferSelect): AnalyzeRow => ({
  id: toEntityId(row.id) as EntityId,
  timestamp: row.timestamp,
  ip: row.ip,
  ua: row.ua,
  country: row.country,
  path: row.path,
  referer: row.referer,
})

@Injectable()
export class AnalyzeRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async record(input: {
    ip?: string | null
    ua?: Record<string, unknown> | null
    country?: string | null
    path?: string | null
    referer?: string | null
  }): Promise<AnalyzeRow> {
    const id = this.snowflake.nextBigInt()
    const [row] = await this.db
      .insert(analyzes)
      .values({
        id,
        timestamp: new Date(),
        ip: input.ip ?? null,
        ua: input.ua ?? null,
        country: input.country ?? null,
        path: input.path ?? null,
        referer: input.referer ?? null,
      })
      .returning()
    return mapRow(row)
  }

  async list(
    params: {
      page?: number
      size?: number
      from?: Date
      to?: Date
      path?: string
    } = {},
  ): Promise<PaginationResult<AnalyzeRow>> {
    const page = Math.max(1, params.page ?? 1)
    const size = Math.min(100, Math.max(1, params.size ?? 50))
    const offset = (page - 1) * size
    const filters: SQL[] = []
    if (params.from) filters.push(gte(analyzes.timestamp, params.from))
    if (params.to) filters.push(lte(analyzes.timestamp, params.to))
    if (params.path) filters.push(eq(analyzes.path, params.path))
    const where = filters.length > 0 ? and(...filters) : undefined
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(analyzes)
        .where(where)
        .orderBy(desc(analyzes.timestamp))
        .limit(size)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(analyzes)
        .where(where),
    ])
    return {
      data: rows.map(mapRow),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async aggregateByPath(
    from: Date,
    to: Date,
    limit = 20,
  ): Promise<Array<{ path: string; count: number }>> {
    const rows = await this.db
      .select({
        path: analyzes.path,
        count: sql<number>`count(*)::int`,
      })
      .from(analyzes)
      .where(and(gte(analyzes.timestamp, from), lte(analyzes.timestamp, to))!)
      .groupBy(analyzes.path)
      .orderBy(sql`count(*) desc`)
      .limit(limit)
    return rows
      .filter((r) => r.path !== null)
      .map((r) => ({ path: r.path as string, count: Number(r.count ?? 0) }))
  }

  async aggregateByDay(
    from: Date,
    to: Date,
  ): Promise<Array<{ day: string; count: number }>> {
    const rows = await this.db
      .select({
        day: sql<string>`to_char(${analyzes.timestamp} at time zone 'UTC', 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(analyzes)
      .where(and(gte(analyzes.timestamp, from), lte(analyzes.timestamp, to))!)
      .groupBy(
        sql`to_char(${analyzes.timestamp} at time zone 'UTC', 'YYYY-MM-DD')`,
      )
      .orderBy(
        sql`to_char(${analyzes.timestamp} at time zone 'UTC', 'YYYY-MM-DD')`,
      )
    return rows.map((r) => ({ day: r.day, count: Number(r.count ?? 0) }))
  }

  async deleteOlderThan(threshold: Date): Promise<number> {
    const result = await this.db
      .delete(analyzes)
      .where(lte(analyzes.timestamp, threshold))
      .returning({ id: analyzes.id })
    return result.length
  }

  async count(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(analyzes)
    return Number(row?.count ?? 0)
  }
}
