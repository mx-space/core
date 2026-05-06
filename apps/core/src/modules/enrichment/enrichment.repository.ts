import { Inject, Injectable } from '@nestjs/common'
import { and, eq, gt, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { enrichmentCache } from '~/database/schema'
import { BaseRepository } from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { SnowflakeService } from '~/shared/id/snowflake.service'

import type { EnrichmentResult, EnrichmentRow } from './enrichment.types'

@Injectable()
export class EnrichmentRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async findByProviderAndExternalId(
    provider: string,
    externalId: string,
  ): Promise<EnrichmentRow | null> {
    const rows = await this.db
      .select()
      .from(enrichmentCache)
      .where(
        and(
          eq(enrichmentCache.provider, provider),
          eq(enrichmentCache.externalId, externalId),
        ),
      )
      .limit(1)
    return rows[0] ? this.mapRow(rows[0]) : null
  }

  async upsert(
    provider: string,
    externalId: string,
    url: string,
    normalized: EnrichmentResult,
    raw: unknown | null,
    expiresAt: Date | null,
  ): Promise<EnrichmentRow> {
    const result = await this.db
      .insert(enrichmentCache)
      .values({
        id: await this.snowflake.nextId(),
        provider,
        externalId,
        url,
        normalized: normalized as any,
        raw,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [enrichmentCache.provider, enrichmentCache.externalId],
        set: {
          normalized: normalized as any,
          raw,
          url,
          expiresAt,
          failureCount: sql`0`,
          lastError: sql`NULL`,
          fetchedAt: new Date(),
        } as any,
      })
      .returning()

    return this.mapRow(result[0])
  }

  async upsertIfAbsent(input: {
    provider: string
    externalId: string
    url: string
    normalized: EnrichmentResult
    raw: unknown | null
    fetchedAt: Date
    expiresAt: Date | null
  }): Promise<void> {
    const existing = await this.findByProviderAndExternalId(
      input.provider,
      input.externalId,
    )
    if (existing) return

    await this.db.insert(enrichmentCache).values({
      id: await this.snowflake.nextId(),
      provider: input.provider,
      externalId: input.externalId,
      url: input.url,
      normalized: input.normalized as any,
      raw: input.raw,
      expiresAt: input.expiresAt,
    })
  }

  async recordFailure(
    provider: string,
    externalId: string,
    error: string,
  ): Promise<void> {
    await this.db
      .update(enrichmentCache)
      .set({
        failureCount: sql`${enrichmentCache.failureCount} + 1`,
        lastError: error,
      })
      .where(
        and(
          eq(enrichmentCache.provider, provider),
          eq(enrichmentCache.externalId, externalId),
        ),
      )
  }

  async deleteByProviderAndExternalId(
    provider: string,
    externalId: string,
  ): Promise<void> {
    await this.db
      .delete(enrichmentCache)
      .where(
        and(
          eq(enrichmentCache.provider, provider),
          eq(enrichmentCache.externalId, externalId),
        ),
      )
  }

  async listPaginated(
    page: number,
    size: number,
    opts?: { onlyFailed?: boolean },
  ) {
    const offset = (page - 1) * size
    const where = opts?.onlyFailed
      ? gt(enrichmentCache.failureCount, 0)
      : undefined

    const rowsQuery = this.db
      .select()
      .from(enrichmentCache)
      .orderBy(sql`${enrichmentCache.createdAt} DESC`)
      .limit(size)
      .offset(offset)
    const rows = where ? await rowsQuery.where(where) : await rowsQuery

    const countQuery = this.db
      .select({ count: sql<number>`count(*)` })
      .from(enrichmentCache)
    const countResult = where ? await countQuery.where(where) : await countQuery

    const total = Number(countResult[0].count)
    return {
      data: rows.map((r) => this.mapRow(r)),
      pagination: this.paginationOf(total, page, size),
    }
  }

  private mapRow(row: any): EnrichmentRow {
    return {
      id: row.id,
      provider: row.provider,
      externalId: row.externalId,
      url: row.url,
      normalized: row.normalized as EnrichmentResult,
      raw: row.raw,
      fetchedAt: row.fetchedAt,
      expiresAt: row.expiresAt,
      failureCount: row.failureCount,
      lastError: row.lastError,
      createdAt: row.createdAt,
    }
  }
}
