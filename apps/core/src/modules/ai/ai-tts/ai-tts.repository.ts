import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { aiTts, aiTtsBlocks } from '~/database/schema'
import {
  BaseRepository,
  type PaginationResult,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import {
  type EntityId,
  parseEntityId,
  tryParseEntityId,
} from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

import type {
  AiTtsBlockRow,
  AiTtsMeta,
  AiTtsRow,
  UpsertBlockInput,
  UpsertParentInput,
} from './ai-tts.types'

const mapParent = (row: typeof aiTts.$inferSelect): AiTtsRow => ({
  id: toEntityId(row.id) as EntityId,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  refId: toEntityId(row.refId) as EntityId,
  lang: row.lang,
  isTranslation: row.isTranslation,
  sourceLang: row.sourceLang,
  model: row.model,
  voice: row.voice,
  speed: row.speed,
  format: row.format,
  blockOrder: row.blockOrder,
  charCount: row.charCount,
  totalDurationMs: row.totalDurationMs,
  sourceModifiedAt: row.sourceModifiedAt,
})

const mapBlock = (row: typeof aiTtsBlocks.$inferSelect): AiTtsBlockRow => ({
  id: toEntityId(row.id) as EntityId,
  createdAt: row.createdAt,
  ttsId: toEntityId(row.ttsId) as EntityId,
  blockId: row.blockId,
  fingerprint: row.fingerprint,
  chunkIndex: row.chunkIndex,
  text: row.text,
  url: row.url,
  storageBackend: row.storageBackend as AiTtsBlockRow['storageBackend'],
  storageKey: row.storageKey,
  byteSize: row.byteSize,
  durationMs: row.durationMs,
})

@Injectable()
export class AiTtsRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async findByRefAndLang(
    refId: EntityId | string,
    lang: string,
  ): Promise<AiTtsRow | null> {
    const [row] = await this.db
      .select()
      .from(aiTts)
      .where(and(eq(aiTts.refId, parseEntityId(refId)), eq(aiTts.lang, lang)))
      .limit(1)
    return row ? mapParent(row) : null
  }

  async findAllByRef(refId: EntityId | string): Promise<AiTtsRow[]> {
    const rows = await this.db
      .select()
      .from(aiTts)
      .where(eq(aiTts.refId, parseEntityId(refId)))
      .orderBy(aiTts.lang)
    return rows.map(mapParent)
  }

  async findBlocks(ttsId: EntityId | string): Promise<AiTtsBlockRow[]> {
    const rows = await this.db
      .select()
      .from(aiTtsBlocks)
      .where(eq(aiTtsBlocks.ttsId, parseEntityId(ttsId)))
      .orderBy(aiTtsBlocks.chunkIndex)
    return rows.map(mapBlock)
  }

  async upsertParent(input: UpsertParentInput): Promise<AiTtsRow> {
    const [row] = await this.db
      .insert(aiTts)
      .values({
        id: this.snowflake.nextId(),
        refId: parseEntityId(input.refId),
        lang: input.lang,
        isTranslation: input.isTranslation,
        sourceLang: input.sourceLang,
        model: input.model,
        voice: input.voice,
        speed: input.speed,
        format: input.format,
        blockOrder: input.blockOrder,
        charCount: input.charCount,
        sourceModifiedAt: input.sourceModifiedAt,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [aiTts.refId, aiTts.lang],
        set: {
          isTranslation: input.isTranslation,
          sourceLang: input.sourceLang,
          model: input.model,
          voice: input.voice,
          speed: input.speed,
          format: input.format,
          blockOrder: input.blockOrder,
          charCount: input.charCount,
          sourceModifiedAt: input.sourceModifiedAt,
          updatedAt: new Date(),
        },
      })
      .returning()
    return mapParent(row)
  }

  async upsertBlock(input: UpsertBlockInput): Promise<AiTtsBlockRow> {
    const [row] = await this.db
      .insert(aiTtsBlocks)
      .values({
        id: this.snowflake.nextId(),
        ttsId: parseEntityId(input.ttsId),
        blockId: input.blockId,
        chunkIndex: input.chunkIndex,
        fingerprint: input.fingerprint,
        text: input.text,
        url: input.url,
        storageBackend: input.storageBackend,
        storageKey: input.storageKey,
        byteSize: input.byteSize ?? null,
        durationMs: input.durationMs ?? null,
      })
      .onConflictDoUpdate({
        target: [
          aiTtsBlocks.ttsId,
          aiTtsBlocks.blockId,
          aiTtsBlocks.chunkIndex,
        ],
        set: {
          fingerprint: input.fingerprint,
          text: input.text,
          url: input.url,
          storageBackend: input.storageBackend,
          storageKey: input.storageKey,
          byteSize: input.byteSize ?? null,
          durationMs: input.durationMs ?? null,
        },
      })
      .returning()
    return mapBlock(row)
  }

  async deleteBlocksByIds(ids: string[]): Promise<void> {
    if (!ids.length) return
    await this.db.delete(aiTtsBlocks).where(
      inArray(
        aiTtsBlocks.id,
        ids.map((id) => parseEntityId(id)),
      ),
    )
  }

  async deleteById(id: EntityId | string): Promise<AiTtsBlockRow[]> {
    const ttsId = parseEntityId(id)
    const blocks = await this.db
      .select()
      .from(aiTtsBlocks)
      .where(eq(aiTtsBlocks.ttsId, ttsId))
    await this.db.delete(aiTts).where(eq(aiTts.id, ttsId))
    return blocks.map(mapBlock)
  }

  async deleteByRefId(refId: EntityId | string): Promise<AiTtsBlockRow[]> {
    const refBig = parseEntityId(refId)
    const parents = await this.db
      .select({ id: aiTts.id })
      .from(aiTts)
      .where(eq(aiTts.refId, refBig))
    if (!parents.length) return []
    const blocks = await this.db
      .select()
      .from(aiTtsBlocks)
      .where(
        inArray(
          aiTtsBlocks.ttsId,
          parents.map((p) => p.id),
        ),
      )
    await this.db.delete(aiTts).where(eq(aiTts.refId, refBig))
    return blocks.map(mapBlock)
  }

  async listPaginated(params: {
    page?: number
    size?: number
    search?: string
  }): Promise<PaginationResult<AiTtsRow>> {
    const page = Math.max(1, params.page ?? 1)
    const size = Math.min(100, Math.max(1, params.size ?? 20))
    const offset = (page - 1) * size

    const search = params.search?.trim()
    const where = search ? this.buildSearchFilter(search) : undefined

    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(aiTts)
        .where(where)
        .orderBy(desc(aiTts.createdAt))
        .limit(size)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(aiTts)
        .where(where),
    ])

    return {
      data: rows.map(mapParent),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  private buildSearchFilter(search: string) {
    const pattern = `%${search}%`
    const conditions = [
      ilike(aiTts.lang, pattern),
      ilike(aiTts.voice, pattern),
      ilike(aiTts.model, pattern),
    ]
    const parsedRefId = tryParseEntityId(search)
    if (parsedRefId.ok) conditions.push(eq(aiTts.refId, parsedRefId.value))
    return or(...conditions)
  }

  async findMeta(
    refId: EntityId | string,
    lang: string,
  ): Promise<AiTtsMeta | null> {
    const [row] = await this.db
      .select({
        id: aiTts.id,
        updatedAt: aiTts.updatedAt,
        sourceModifiedAt: aiTts.sourceModifiedAt,
        blockCount: sql<number>`jsonb_array_length(${aiTts.blockOrder})`,
      })
      .from(aiTts)
      .where(and(eq(aiTts.refId, parseEntityId(refId)), eq(aiTts.lang, lang)))
      .limit(1)
    if (!row) return null
    return {
      id: toEntityId(row.id) as EntityId,
      updatedAt: row.updatedAt,
      sourceModifiedAt: row.sourceModifiedAt,
      blockCount: Number(row.blockCount ?? 0),
    }
  }
}
