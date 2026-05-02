import { Inject, Injectable } from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { aiInsights } from '~/database/schema'
import {
  BaseRepository,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

export interface AiInsightsRow {
  id: EntityId
  refId: EntityId
  lang: string
  hash: string
  content: string
  isTranslation: boolean
  sourceInsightsId: EntityId | null
  sourceLang: string | null
  modelInfo: Record<string, unknown> | null
  createdAt: Date
}

const mapRow = (row: typeof aiInsights.$inferSelect): AiInsightsRow => ({
  id: toEntityId(row.id) as EntityId,
  refId: toEntityId(row.refId) as EntityId,
  lang: row.lang,
  hash: row.hash,
  content: row.content,
  isTranslation: row.isTranslation,
  sourceInsightsId: row.sourceInsightsId
    ? (toEntityId(row.sourceInsightsId) as EntityId)
    : null,
  sourceLang: row.sourceLang,
  modelInfo: row.modelInfo,
  createdAt: row.createdAt,
})

@Injectable()
export class AiInsightsRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async findByRefAndLang(
    refId: EntityId | string,
    lang: string,
  ): Promise<AiInsightsRow | null> {
    const refBig = parseEntityId(refId)
    const [row] = await this.db
      .select()
      .from(aiInsights)
      .where(and(eq(aiInsights.refId, refBig), eq(aiInsights.lang, lang))!)
      .limit(1)
    return row ? mapRow(row) : null
  }

  async listForRef(refId: EntityId | string): Promise<AiInsightsRow[]> {
    const refBig = parseEntityId(refId)
    const rows = await this.db
      .select()
      .from(aiInsights)
      .where(eq(aiInsights.refId, refBig))
    return rows.map(mapRow)
  }

  async upsert(input: {
    refId: EntityId | string
    lang: string
    hash: string
    content: string
    isTranslation?: boolean
    sourceInsightsId?: EntityId | string | null
    sourceLang?: string | null
    modelInfo?: Record<string, unknown> | null
  }): Promise<AiInsightsRow> {
    const refBig = parseEntityId(input.refId)
    const [existing] = await this.db
      .select()
      .from(aiInsights)
      .where(
        and(eq(aiInsights.refId, refBig), eq(aiInsights.lang, input.lang))!,
      )
      .limit(1)
    if (existing) {
      const [row] = await this.db
        .update(aiInsights)
        .set({
          hash: input.hash,
          content: input.content,
          isTranslation: input.isTranslation ?? existing.isTranslation,
          sourceInsightsId: input.sourceInsightsId
            ? parseEntityId(input.sourceInsightsId)
            : existing.sourceInsightsId,
          sourceLang: input.sourceLang ?? existing.sourceLang,
          modelInfo: input.modelInfo ?? existing.modelInfo,
        })
        .where(eq(aiInsights.id, existing.id))
        .returning()
      return mapRow(row)
    }
    const id = this.snowflake.nextBigInt()
    const [row] = await this.db
      .insert(aiInsights)
      .values({
        id,
        refId: refBig,
        lang: input.lang,
        hash: input.hash,
        content: input.content,
        isTranslation: input.isTranslation ?? false,
        sourceInsightsId: input.sourceInsightsId
          ? parseEntityId(input.sourceInsightsId)
          : null,
        sourceLang: input.sourceLang ?? null,
        modelInfo: input.modelInfo ?? null,
      })
      .returning()
    return mapRow(row)
  }

  async deleteForRef(refId: EntityId | string): Promise<number> {
    const refBig = parseEntityId(refId)
    const result = await this.db
      .delete(aiInsights)
      .where(eq(aiInsights.refId, refBig))
      .returning({ id: aiInsights.id })
    return result.length
  }

  async count(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiInsights)
    return Number(row?.count ?? 0)
  }
}
