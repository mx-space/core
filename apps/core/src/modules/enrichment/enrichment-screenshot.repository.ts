import { Inject, Injectable } from '@nestjs/common'
import { asc, eq, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import {
  type EnrichmentScreenshotPalette,
  enrichmentScreenshots,
} from '~/database/schema'
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
