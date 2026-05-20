import { Inject, Injectable } from '@nestjs/common'
import { asc, desc, eq, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import {
  enrichmentCache,
  enrichmentCaptures,
  type EnrichmentImagePalette,
} from '~/database/schema'
import type { PaginationResult } from '~/processors/database/base.repository'
import { BaseRepository } from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'

export interface EnrichmentCaptureRow {
  enrichmentId: string
  objectKey: string
  bytes: number
  width: number
  height: number
  blurhash: string | null
  palette: EnrichmentImagePalette | null
  createdAt: Date
  lastAccessedAt: Date
}

export interface EnrichmentCaptureJoinedRow {
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
  palette: EnrichmentImagePalette | null
  createdAt: Date
  lastAccessedAt: Date
}

export type EnrichmentCaptureListSort = 'last_accessed' | 'created' | 'bytes'
export type EnrichmentCaptureListOrder = 'asc' | 'desc'

export interface EnrichmentCaptureInsert {
  enrichmentId: string
  objectKey: string
  bytes: number
  width: number
  height: number
  blurhash?: string | null
  palette?: EnrichmentImagePalette | null
}

@Injectable()
export class EnrichmentCaptureRepository extends BaseRepository {
  constructor(@Inject(PG_DB_TOKEN) db: AppDatabase) {
    super(db)
  }

  async findByEnrichmentId(
    enrichmentId: string,
  ): Promise<EnrichmentCaptureRow | null> {
    const rows = await this.db
      .select()
      .from(enrichmentCaptures)
      .where(eq(enrichmentCaptures.enrichmentId, enrichmentId))
      .limit(1)
    return rows[0] ? this.mapRow(rows[0]) : null
  }

  /**
   * Inserts or replaces the capture row for an enrichment.
   * `last_accessed_at` is set to `now()` on both insert and update — callers
   * do not need to follow with `touchAccess()`.
   */
  async upsert(input: EnrichmentCaptureInsert): Promise<EnrichmentCaptureRow> {
    const [row] = await this.db
      .insert(enrichmentCaptures)
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
        target: enrichmentCaptures.enrichmentId,
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
      .delete(enrichmentCaptures)
      .where(eq(enrichmentCaptures.enrichmentId, enrichmentId))
  }

  /**
   * Refresh `last_accessed_at` to now. Caller is responsible for throttling
   * (e.g. Redis NX-EX gate) to avoid write amplification on hot rows.
   */
  async touchAccess(enrichmentId: string): Promise<void> {
    await this.db
      .update(enrichmentCaptures)
      .set({ lastAccessedAt: new Date() })
      .where(eq(enrichmentCaptures.enrichmentId, enrichmentId))
  }

  async listJoined(
    page: number,
    size: number,
    sort: EnrichmentCaptureListSort,
    order: EnrichmentCaptureListOrder,
  ): Promise<PaginationResult<EnrichmentCaptureJoinedRow>> {
    const offset = (page - 1) * size
    const sortColumn =
      sort === 'created'
        ? enrichmentCaptures.createdAt
        : sort === 'bytes'
          ? enrichmentCaptures.bytes
          : enrichmentCaptures.lastAccessedAt
    const orderBy = order === 'asc' ? asc(sortColumn) : desc(sortColumn)

    const rows = await this.db
      .select({
        enrichmentId: enrichmentCaptures.enrichmentId,
        provider: enrichmentCache.provider,
        externalId: enrichmentCache.externalId,
        url: enrichmentCache.url,
        title: sql<string | null>`${enrichmentCache.normalized}->>'title'`.as(
          'title',
        ),
        objectKey: enrichmentCaptures.objectKey,
        bytes: enrichmentCaptures.bytes,
        width: enrichmentCaptures.width,
        height: enrichmentCaptures.height,
        blurhash: enrichmentCaptures.blurhash,
        palette: enrichmentCaptures.palette,
        createdAt: enrichmentCaptures.createdAt,
        lastAccessedAt: enrichmentCaptures.lastAccessedAt,
      })
      .from(enrichmentCaptures)
      .leftJoin(
        enrichmentCache,
        eq(enrichmentCaptures.enrichmentId, enrichmentCache.id),
      )
      .orderBy(orderBy)
      .limit(size)
      .offset(offset)

    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(enrichmentCaptures)
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
        totalBytes: sql<number>`coalesce(sum(${enrichmentCaptures.bytes}), 0)`,
      })
      .from(enrichmentCaptures)
    return {
      count: Number(row?.count ?? 0),
      totalBytes: Number(row?.totalBytes ?? 0),
    }
  }

  /**
   * Return the oldest-accessed rows for LRU eviction.
   */
  async findOldestByAccess(limit: number): Promise<EnrichmentCaptureRow[]> {
    const rows = await this.db
      .select()
      .from(enrichmentCaptures)
      .orderBy(asc(enrichmentCaptures.lastAccessedAt))
      .limit(limit)
    return rows.map((r) => this.mapRow(r))
  }

  private mapRow(
    row: typeof enrichmentCaptures.$inferSelect,
  ): EnrichmentCaptureRow {
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
