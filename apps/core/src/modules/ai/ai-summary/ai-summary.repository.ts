import { Inject, Injectable } from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { aiSummaries } from '~/database/schema'
import {
  BaseRepository,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

export interface AiSummaryRow {
  id: EntityId
  hash: string
  summary: string
  refId: EntityId
  lang: string | null
  createdAt: Date
}

const mapRow = (row: typeof aiSummaries.$inferSelect): AiSummaryRow => ({
  id: toEntityId(row.id) as EntityId,
  hash: row.hash,
  summary: row.summary,
  refId: toEntityId(row.refId) as EntityId,
  lang: row.lang,
  createdAt: row.createdAt,
})

@Injectable()
export class AiSummaryRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async findByRefAndLang(
    refId: EntityId | string,
    lang: string | null = null,
  ): Promise<AiSummaryRow | null> {
    const refBig = parseEntityId(refId)
    const conds = [eq(aiSummaries.refId, refBig)]
    if (lang === null) {
      conds.push(sql`${aiSummaries.lang} is null`)
    } else {
      conds.push(eq(aiSummaries.lang, lang))
    }
    const [row] = await this.db
      .select()
      .from(aiSummaries)
      .where(and(...conds))
      .limit(1)
    return row ? mapRow(row) : null
  }

  async findByHash(
    refId: EntityId | string,
    hash: string,
  ): Promise<AiSummaryRow | null> {
    const refBig = parseEntityId(refId)
    const [row] = await this.db
      .select()
      .from(aiSummaries)
      .where(and(eq(aiSummaries.refId, refBig), eq(aiSummaries.hash, hash))!)
      .limit(1)
    return row ? mapRow(row) : null
  }

  async upsert(input: {
    refId: EntityId | string
    hash: string
    summary: string
    lang?: string | null
  }): Promise<AiSummaryRow> {
    const refBig = parseEntityId(input.refId)
    const lang = input.lang ?? null
    const conds = [eq(aiSummaries.refId, refBig)]
    if (lang === null) conds.push(sql`${aiSummaries.lang} is null`)
    else conds.push(eq(aiSummaries.lang, lang))
    const [existing] = await this.db
      .select()
      .from(aiSummaries)
      .where(and(...conds))
      .limit(1)
    if (existing) {
      const [row] = await this.db
        .update(aiSummaries)
        .set({ hash: input.hash, summary: input.summary })
        .where(eq(aiSummaries.id, existing.id))
        .returning()
      return mapRow(row)
    }
    const id = this.snowflake.nextBigInt()
    const [row] = await this.db
      .insert(aiSummaries)
      .values({
        id,
        refId: refBig,
        hash: input.hash,
        summary: input.summary,
        lang,
      })
      .returning()
    return mapRow(row)
  }

  async deleteForRef(refId: EntityId | string): Promise<number> {
    const refBig = parseEntityId(refId)
    const result = await this.db
      .delete(aiSummaries)
      .where(eq(aiSummaries.refId, refBig))
      .returning({ id: aiSummaries.id })
    return result.length
  }
}
