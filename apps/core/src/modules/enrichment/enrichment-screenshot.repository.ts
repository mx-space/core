import { Inject, Injectable } from '@nestjs/common'
import { asc, desc, eq, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import {
  enrichmentCache,
  type EnrichmentScreenshotPalette,
  enrichmentScreenshots,
} from '~/database/schema'
import type { PaginationResult } from '~/processors/database/base.repository'
import { BaseRepository } from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'

export interface EnrichmentScreenshotRow {
  enrichmentId: string
  objectKey: string
  bytes: number
  width: number
  height: number
  blurhash: string | null
  palette: EnrichmentScreenshotPalette | null
  createdAt: Date
  lastAccessedAt: Date
}

export interface EnrichmentScreenshotJoinedRow {
  enrichmentId: string
  provider: string
  externalId: string
  url: string
  title: string
  objectKey: string
  bytes: number
  width: number
  height: number
  blurhash: string | null
  palette: EnrichmentScreenshotPalette | null
  createdAt: Date
  lastAccessedAt: Date
}

export type EnrichmentScreenshotListSort = 'last_accessed' | 'created' | 'bytes'
export type EnrichmentScreenshotListOrder = 'asc' | 'desc'

export interface EnrichmentScreenshotInsert {
  enrichmentId: string
  objectKey: string
  bytes: number
  width: number
  height: number
  blurhash?: string | null
  palette?: EnrichmentScreenshotPalette | null
}

@Injectable()
export class EnrichmentScreenshotRepository extends BaseRepository {
  constructor(@Inject(PG_DB_TOKEN) db: AppDatabase) {
    super(db)
  }

  async findByEnrichmentId(
    enrichmentId: string,
  ): Promise<EnrichmentScreenshotRow | null> {
    const rows = await this.db
      .select()
      .from(enrichmentScreenshots)
      .where(eq(enrichmentScreenshots.enrichmentId, enrichmentId))
      .limit(1)
    return rows[0] ? this.mapRow(rows[0]) : null
  }

  /**
   * Inserts or replaces the screenshot row for an enrichment.
   * `last_accessed_at` is set to `now()` on both insert and update — callers
   * do not need to follow with `touchAccess()`.
   */
  async upsert(
    input: EnrichmentScreenshotInsert,
  ): Promise<EnrichmentScreenshotRow> {
    const [row] = await this.db
      .insert(enrichmentScreenshots)
      .values({
        enrichmentId: input.enrichmentId,
        objectKey: input.objectKey,
        bytes: input.bytes,
        width: input.width,
        height: input.height,
        blurhash: input.blurhash ?? null,
        palette: input.palette ?? null,
      })
      .onConflictDoUpdate({
        target: enrichmentScreenshots.enrichmentId,
        set: {
          objectKey: sql`excluded.object_key`,
          bytes: sql`excluded.bytes`,
          width: sql`excluded.width`,
          height: sql`excluded.height`,
          blurhash: sql`excluded.blurhash`,
          palette: sql`excluded.palette`,
          lastAccessedAt: sql`now()`,
        },
      })
      .returning()
    return this.mapRow(row)
  }

  async deleteByEnrichmentId(enrichmentId: string): Promise<void> {
    await this.db
      .delete(enrichmentScreenshots)
      .where(eq(enrichmentScreenshots.enrichmentId, enrichmentId))
  }

  /**
   * Refresh `last_accessed_at` to now. Caller is responsible for throttling
   * (e.g. Redis NX-EX gate) to avoid write amplification on hot rows.
   */
  async touchAccess(enrichmentId: string): Promise<void> {
    await this.db
      .update(enrichmentScreenshots)
      .set({ lastAccessedAt: new Date() })
      .where(eq(enrichmentScreenshots.enrichmentId, enrichmentId))
  }

  async listJoined(
    page: number,
    size: number,
    sort: EnrichmentScreenshotListSort,
    order: EnrichmentScreenshotListOrder,
  ): Promise<PaginationResult<EnrichmentScreenshotJoinedRow>> {
    const offset = (page - 1) * size
    const sortColumn =
      sort === 'created'
        ? enrichmentScreenshots.createdAt
        : sort === 'bytes'
          ? enrichmentScreenshots.bytes
          : enrichmentScreenshots.lastAccessedAt
    const orderBy = order === 'asc' ? asc(sortColumn) : desc(sortColumn)

    const rows = await this.db
      .select({
        enrichmentId: enrichmentScreenshots.enrichmentId,
        provider: enrichmentCache.provider,
        externalId: enrichmentCache.externalId,
        url: enrichmentCache.url,
        title: sql<string | null>`${enrichmentCache.normalized}->>'title'`.as(
          'title',
        ),
        objectKey: enrichmentScreenshots.objectKey,
        bytes: enrichmentScreenshots.bytes,
        width: enrichmentScreenshots.width,
        height: enrichmentScreenshots.height,
        blurhash: enrichmentScreenshots.blurhash,
        palette: enrichmentScreenshots.palette,
        createdAt: enrichmentScreenshots.createdAt,
        lastAccessedAt: enrichmentScreenshots.lastAccessedAt,
      })
      .from(enrichmentScreenshots)
      .leftJoin(
        enrichmentCache,
        eq(enrichmentScreenshots.enrichmentId, enrichmentCache.id),
      )
      .orderBy(orderBy)
      .limit(size)
      .offset(offset)

    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(enrichmentScreenshots)
    const total = Number(countResult[0]?.count ?? 0)

    return {
      data: rows.map((r) => ({
        enrichmentId: r.enrichmentId,
        provider: r.provider ?? '',
        externalId: r.externalId ?? '',
        url: r.url ?? '',
        title: r.title ?? '',
        objectKey: r.objectKey,
        bytes: r.bytes,
        width: r.width,
        height: r.height,
        blurhash: r.blurhash,
        palette: r.palette,
        createdAt: r.createdAt,
        lastAccessedAt: r.lastAccessedAt,
      })),
      pagination: this.paginationOf(total, page, size),
    }
  }

  async getQuotaUsage(): Promise<{ count: number; totalBytes: number }> {
    const [row] = await this.db
      .select({
        count: sql<number>`count(*)`,
        totalBytes: sql<number>`coalesce(sum(${enrichmentScreenshots.bytes}), 0)`,
      })
      .from(enrichmentScreenshots)
    return {
      count: Number(row?.count ?? 0),
      totalBytes: Number(row?.totalBytes ?? 0),
    }
  }

  /**
   * Return the oldest-accessed rows for LRU eviction.
   */
  async findOldestByAccess(limit: number): Promise<EnrichmentScreenshotRow[]> {
    const rows = await this.db
      .select()
      .from(enrichmentScreenshots)
      .orderBy(asc(enrichmentScreenshots.lastAccessedAt))
      .limit(limit)
    return rows.map((r) => this.mapRow(r))
  }

  private mapRow(
    row: typeof enrichmentScreenshots.$inferSelect,
  ): EnrichmentScreenshotRow {
    return {
      enrichmentId: row.enrichmentId,
      objectKey: row.objectKey,
      bytes: row.bytes,
      width: row.width,
      height: row.height,
      blurhash: row.blurhash,
      palette: row.palette,
      createdAt: row.createdAt,
      lastAccessedAt: row.lastAccessedAt,
    }
  }
}
