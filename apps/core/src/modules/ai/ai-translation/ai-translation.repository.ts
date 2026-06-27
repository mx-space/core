import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, inArray, or, type SQL, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { aiTranslations, translationEntries } from '~/database/schema'
import {
  BaseRepository,
  type PaginationResult,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

import type {
  AiTranslationRow,
  TranslationEntryRow,
} from './ai-translation.types'
import type { TranslationEntryKeyPath } from './translation-entry.types'

const mapTranslation = (
  row: typeof aiTranslations.$inferSelect,
): AiTranslationRow => ({
  id: toEntityId(row.id) as EntityId,
  hash: row.hash,
  refId: toEntityId(row.refId) as EntityId,
  refType: row.refType,
  lang: row.lang,
  sourceLang: row.sourceLang,
  title: row.title,
  text: row.text,
  subtitle: row.subtitle,
  summary: row.summary,
  tags: row.tags,
  sourceModifiedAt: row.sourceModifiedAt,
  aiModel: row.aiModel,
  aiProvider: row.aiProvider,
  contentFormat: row.contentFormat,
  content: row.content,
  sourceBlockSnapshots: row.sourceBlockSnapshots,
  sourceMetaHashes: row.sourceMetaHashes,
  createdAt: row.createdAt,
})

const mapEntry = (
  row: typeof translationEntries.$inferSelect,
): TranslationEntryRow => ({
  id: toEntityId(row.id) as EntityId,
  keyPath: row.keyPath as TranslationEntryKeyPath,
  lang: row.lang,
  keyType: row.keyType,
  lookupKey: row.lookupKey,
  sourceText: row.sourceText,
  translatedText: row.translatedText,
  sourceUpdatedAt: row.sourceUpdatedAt,
  createdAt: row.createdAt,
})

@Injectable()
export class AiTranslationRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async findByRef(
    refId: EntityId | string,
    refType: string,
    lang: string,
  ): Promise<AiTranslationRow | null> {
    const refBig = parseEntityId(refId)
    const [row] = await this.db
      .select()
      .from(aiTranslations)
      .where(
        and(
          eq(aiTranslations.refId, refBig),
          eq(aiTranslations.refType, refType),
          eq(aiTranslations.lang, lang),
        )!,
      )
      .limit(1)
    return row ? mapTranslation(row) : null
  }

  async findByRefAndLang(
    refId: EntityId | string,
    lang: string,
  ): Promise<AiTranslationRow | null> {
    const refBig = parseEntityId(refId)
    const [row] = await this.db
      .select()
      .from(aiTranslations)
      .where(
        and(eq(aiTranslations.refId, refBig), eq(aiTranslations.lang, lang))!,
      )
      .limit(1)
    return row ? mapTranslation(row) : null
  }

  async findById(id: EntityId | string): Promise<AiTranslationRow | null> {
    const [row] = await this.db
      .select()
      .from(aiTranslations)
      .where(eq(aiTranslations.id, parseEntityId(id)))
      .limit(1)
    return row ? mapTranslation(row) : null
  }

  async listByRefId(refId: EntityId | string): Promise<AiTranslationRow[]> {
    const rows = await this.db
      .select()
      .from(aiTranslations)
      .where(eq(aiTranslations.refId, parseEntityId(refId)))
      .orderBy(desc(aiTranslations.createdAt))
    return rows.map(mapTranslation)
  }

  async listByRefIds(
    refIds: Array<EntityId | string>,
  ): Promise<AiTranslationRow[]> {
    if (!refIds.length) return []
    const rows = await this.db
      .select()
      .from(aiTranslations)
      .where(
        inArray(
          aiTranslations.refId,
          refIds.map((id) => parseEntityId(id)),
        ),
      )
      .orderBy(desc(aiTranslations.createdAt))
    return rows.map(mapTranslation)
  }

  async listByRefIdsAndLang(
    refIds: Array<EntityId | string>,
    lang: string,
  ): Promise<AiTranslationRow[]> {
    if (!refIds.length) return []
    const rows = await this.db
      .select()
      .from(aiTranslations)
      .where(
        and(
          inArray(
            aiTranslations.refId,
            refIds.map((id) => parseEntityId(id)),
          ),
          eq(aiTranslations.lang, lang),
        )!,
      )
      .orderBy(desc(aiTranslations.createdAt))
    return rows.map(mapTranslation)
  }

  async findDistinctRefIds(
    refIds?: Array<EntityId | string>,
  ): Promise<EntityId[]> {
    const where = refIds?.length
      ? inArray(
          aiTranslations.refId,
          refIds.map((id) => parseEntityId(id)),
        )
      : undefined
    const rows = await this.db
      .selectDistinct({ refId: aiTranslations.refId })
      .from(aiTranslations)
      .where(where)
    return rows.map((r) => toEntityId(r.refId) as EntityId)
  }

  async groupByRefIdPaginated(
    page = 1,
    size = 20,
    refIds?: Array<EntityId | string>,
  ): Promise<
    PaginationResult<{
      refId: EntityId
      latestCreatedAt: Date
      translationCount: number
    }>
  > {
    page = Math.max(1, page)
    size = Math.min(100, Math.max(1, size))
    const offset = (page - 1) * size
    const latestCreatedAtCol = sql<Date>`max(${aiTranslations.createdAt})`
    const countCol = sql<number>`count(*)::int`
    const where = refIds?.length
      ? inArray(
          aiTranslations.refId,
          refIds.map((id) => parseEntityId(id)),
        )
      : undefined
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          refId: aiTranslations.refId,
          latestCreatedAt: latestCreatedAtCol,
          translationCount: countCol,
        })
        .from(aiTranslations)
        .where(where)
        .groupBy(aiTranslations.refId)
        .orderBy(desc(latestCreatedAtCol))
        .limit(size)
        .offset(offset),
      this.db
        .select({
          total: sql<number>`count(distinct ${aiTranslations.refId})::int`,
        })
        .from(aiTranslations)
        .where(where),
    ])
    return {
      data: rows.map((row) => ({
        refId: toEntityId(row.refId) as EntityId,
        latestCreatedAt: row.latestCreatedAt,
        translationCount: Number(row.translationCount ?? 0),
      })),
      pagination: this.paginationOf(Number(total ?? 0), page, size),
    }
  }

  async list(page = 1, size = 20): Promise<PaginationResult<AiTranslationRow>> {
    page = Math.max(1, page)
    size = Math.min(100, Math.max(1, size))
    const offset = (page - 1) * size
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(aiTranslations)
        .orderBy(desc(aiTranslations.createdAt))
        .limit(size)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(aiTranslations),
    ])
    return {
      data: rows.map(mapTranslation),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async upsert(
    input: Omit<AiTranslationRow, 'id' | 'refId' | 'createdAt'> & {
      id?: EntityId | string
      refId: EntityId | string
    },
  ): Promise<AiTranslationRow> {
    const refBig = parseEntityId(input.refId)
    const updatableColumns = {
      hash: input.hash,
      sourceLang: input.sourceLang,
      title: input.title,
      text: input.text,
      subtitle: input.subtitle,
      summary: input.summary,
      tags: input.tags ?? [],
      sourceModifiedAt: input.sourceModifiedAt,
      aiModel: input.aiModel,
      aiProvider: input.aiProvider,
      contentFormat: input.contentFormat,
      content: input.content,
      sourceBlockSnapshots: input.sourceBlockSnapshots,
      sourceMetaHashes: input.sourceMetaHashes,
    }
    const [row] = await this.db
      .insert(aiTranslations)
      .values({
        id: this.snowflake.nextId(),
        refId: refBig,
        refType: input.refType,
        lang: input.lang,
        ...updatableColumns,
      })
      .onConflictDoUpdate({
        target: [
          aiTranslations.refId,
          aiTranslations.refType,
          aiTranslations.lang,
        ],
        set: updatableColumns,
      })
      .returning()
    return mapTranslation(row)
  }

  async updateById(
    id: EntityId | string,
    patch: Partial<Omit<AiTranslationRow, 'id' | 'createdAt'>>,
  ): Promise<AiTranslationRow | null> {
    const update: Partial<typeof aiTranslations.$inferInsert> = {}
    if (patch.hash !== undefined) update.hash = patch.hash
    if (patch.refId !== undefined) update.refId = parseEntityId(patch.refId)
    if (patch.refType !== undefined) update.refType = patch.refType
    if (patch.lang !== undefined) update.lang = patch.lang
    if (patch.sourceLang !== undefined) update.sourceLang = patch.sourceLang
    if (patch.title !== undefined) update.title = patch.title
    if (patch.text !== undefined) update.text = patch.text
    if (patch.subtitle !== undefined) update.subtitle = patch.subtitle
    if (patch.summary !== undefined) update.summary = patch.summary
    if (patch.tags !== undefined) update.tags = patch.tags
    if (patch.sourceModifiedAt !== undefined)
      update.sourceModifiedAt = patch.sourceModifiedAt
    if (patch.aiModel !== undefined) update.aiModel = patch.aiModel
    if (patch.aiProvider !== undefined) update.aiProvider = patch.aiProvider
    if (patch.contentFormat !== undefined)
      update.contentFormat = patch.contentFormat
    if (patch.content !== undefined) update.content = patch.content
    if (patch.sourceBlockSnapshots !== undefined)
      update.sourceBlockSnapshots = patch.sourceBlockSnapshots
    if (patch.sourceMetaHashes !== undefined)
      update.sourceMetaHashes = patch.sourceMetaHashes
    const [row] = await this.db
      .update(aiTranslations)
      .set(update)
      .where(eq(aiTranslations.id, parseEntityId(id)))
      .returning()
    return row ? mapTranslation(row) : null
  }

  async deleteForRefId(refId: EntityId | string): Promise<number> {
    const result = await this.db
      .delete(aiTranslations)
      .where(eq(aiTranslations.refId, parseEntityId(refId)))
      .returning({ id: aiTranslations.id })
    return result.length
  }

  async deleteById(id: EntityId | string): Promise<number> {
    const result = await this.db
      .delete(aiTranslations)
      .where(eq(aiTranslations.id, parseEntityId(id)))
      .returning({ id: aiTranslations.id })
    return result.length
  }
}

@Injectable()
export class TranslationEntryRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async listByBatch(
    lang: string,
    lookups: Array<{
      keyPath: string
      keyType: string
      lookupKeys: string[]
    }>,
  ): Promise<TranslationEntryRow[]> {
    if (!lookups.length) return []
    const rows: TranslationEntryRow[] = []
    for (const lookup of lookups) {
      if (!lookup.lookupKeys.length) continue
      const found = await this.db
        .select()
        .from(translationEntries)
        .where(
          and(
            eq(translationEntries.lang, lang),
            eq(translationEntries.keyPath, lookup.keyPath),
            eq(translationEntries.keyType, lookup.keyType),
            inArray(translationEntries.lookupKey, lookup.lookupKeys),
          )!,
        )
      rows.push(...found.map(mapEntry))
    }
    return rows
  }

  async listByKeyPath(
    keyPath: string,
    lookupKey: string,
  ): Promise<TranslationEntryRow[]> {
    const rows = await this.db
      .select()
      .from(translationEntries)
      .where(
        and(
          eq(translationEntries.keyPath, keyPath),
          eq(translationEntries.lookupKey, lookupKey),
        )!,
      )
    return rows.map(mapEntry)
  }

  async deleteByKeyPath(keyPath: string, lookupKey: string): Promise<number> {
    const result = await this.db
      .delete(translationEntries)
      .where(
        and(
          eq(translationEntries.keyPath, keyPath),
          eq(translationEntries.lookupKey, lookupKey),
        )!,
      )
      .returning({ id: translationEntries.id })
    return result.length
  }

  async upsert(input: {
    keyPath: string
    lang: string
    keyType: string
    lookupKey: string
    sourceText: string
    translatedText: string
    sourceUpdatedAt?: Date | null
  }): Promise<TranslationEntryRow> {
    const [row] = await this.db
      .insert(translationEntries)
      .values({
        id: this.snowflake.nextId(),
        keyPath: input.keyPath,
        lang: input.lang,
        keyType: input.keyType,
        lookupKey: input.lookupKey,
        sourceText: input.sourceText,
        translatedText: input.translatedText,
        sourceUpdatedAt: input.sourceUpdatedAt ?? null,
      })
      .onConflictDoUpdate({
        target: [
          translationEntries.keyPath,
          translationEntries.lang,
          translationEntries.keyType,
          translationEntries.lookupKey,
        ],
        set: {
          sourceText: input.sourceText,
          translatedText: input.translatedText,
          // Preserve the stored sourceUpdatedAt when the caller does not
          // provide one (entity updates stamp it, dict entries do not).
          ...(input.sourceUpdatedAt != null
            ? { sourceUpdatedAt: input.sourceUpdatedAt }
            : {}),
        },
      })
      .returning()
    return mapEntry(row)
  }

  async listFiltered(
    filter: {
      keyPath?: string
      lang?: string
      lookupKey?: string
    } = {},
  ): Promise<TranslationEntryRow[]> {
    const conditions: SQL<unknown>[] = []
    if (filter.keyPath)
      conditions.push(eq(translationEntries.keyPath, filter.keyPath))
    if (filter.lang) conditions.push(eq(translationEntries.lang, filter.lang))
    if (filter.lookupKey)
      conditions.push(eq(translationEntries.lookupKey, filter.lookupKey))
    const where = conditions.length ? and(...conditions) : undefined
    const rows = await this.db
      .select()
      .from(translationEntries)
      .where(where)
      .orderBy(desc(translationEntries.createdAt))
    return rows.map(mapEntry)
  }

  async findById(id: EntityId | string): Promise<TranslationEntryRow | null> {
    const [row] = await this.db
      .select()
      .from(translationEntries)
      .where(eq(translationEntries.id, parseEntityId(id)))
      .limit(1)
    return row ? mapEntry(row) : null
  }

  async updateTranslatedText(
    id: EntityId | string,
    translatedText: string,
  ): Promise<TranslationEntryRow | null> {
    const [row] = await this.db
      .update(translationEntries)
      .set({ translatedText })
      .where(eq(translationEntries.id, parseEntityId(id)))
      .returning()
    return row ? mapEntry(row) : null
  }

  async deleteById(id: EntityId | string): Promise<TranslationEntryRow | null> {
    const [row] = await this.db
      .delete(translationEntries)
      .where(eq(translationEntries.id, parseEntityId(id)))
      .returning()
    return row ? mapEntry(row) : null
  }

  async listByKeyPathLookupKeys(
    keyPathLookupKeys: Array<{ keyPath: string; lookupKey: string }>,
  ): Promise<TranslationEntryRow[]> {
    if (!keyPathLookupKeys.length) return []
    const rows = await this.db
      .select()
      .from(translationEntries)
      .where(
        or(
          ...keyPathLookupKeys.map(
            ({ keyPath, lookupKey }) =>
              and(
                eq(translationEntries.keyPath, keyPath),
                eq(translationEntries.lookupKey, lookupKey),
              )!,
          ),
        )!,
      )
    return rows.map(mapEntry)
  }

  async listPaginated(
    filter: { keyPath?: string; lang?: string },
    page = 1,
    size = 20,
  ): Promise<PaginationResult<TranslationEntryRow>> {
    page = Math.max(1, page)
    size = Math.min(100, Math.max(1, size))
    const offset = (page - 1) * size
    const conditions: SQL<unknown>[] = []
    if (filter.keyPath)
      conditions.push(eq(translationEntries.keyPath, filter.keyPath))
    if (filter.lang) conditions.push(eq(translationEntries.lang, filter.lang))
    const where = conditions.length ? and(...conditions) : undefined
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(translationEntries)
        .where(where)
        .orderBy(desc(translationEntries.createdAt))
        .limit(size)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(translationEntries)
        .where(where),
    ])
    return {
      data: rows.map(mapEntry),
      pagination: this.paginationOf(Number(count ?? 0), page, size),
    }
  }

  async deleteMany(filter: {
    keyPath: string
    lookupKey?: string
    langs?: string[]
  }): Promise<number> {
    const conditions: SQL<unknown>[] = [
      eq(translationEntries.keyPath, filter.keyPath),
    ]
    if (filter.lookupKey)
      conditions.push(eq(translationEntries.lookupKey, filter.lookupKey))
    if (filter.langs?.length)
      conditions.push(inArray(translationEntries.lang, filter.langs))
    const result = await this.db
      .delete(translationEntries)
      .where(and(...conditions)!)
      .returning({ id: translationEntries.id })
    return result.length
  }
}
