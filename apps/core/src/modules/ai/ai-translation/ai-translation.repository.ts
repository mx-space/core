import { Inject, Injectable } from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { aiTranslations, translationEntries } from '~/database/schema'
import {
  BaseRepository,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

export interface AiTranslationRow {
  id: EntityId
  hash: string
  refId: EntityId
  refType: string
  lang: string
  sourceLang: string
  title: string
  text: string
  subtitle: string | null
  summary: string | null
  tags: string[]
  sourceModifiedAt: Date | null
  aiModel: string | null
  aiProvider: string | null
  contentFormat: string | null
  content: string | null
  sourceBlockSnapshots: unknown
  sourceMetaHashes: unknown
  createdAt: Date
}

export interface TranslationEntryRow {
  id: EntityId
  keyPath: string
  lang: string
  keyType: string
  lookupKey: string
  sourceText: string
  translatedText: string
  sourceUpdatedAt: Date | null
  createdAt: Date
}

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
  keyPath: row.keyPath,
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

  async listForRef(
    refId: EntityId | string,
    refType: string,
  ): Promise<AiTranslationRow[]> {
    const refBig = parseEntityId(refId)
    const rows = await this.db
      .select()
      .from(aiTranslations)
      .where(
        and(
          eq(aiTranslations.refId, refBig),
          eq(aiTranslations.refType, refType),
        )!,
      )
    return rows.map(mapTranslation)
  }

  async upsert(
    input: Omit<AiTranslationRow, 'id' | 'createdAt'> & {
      id?: EntityId | string
    },
  ): Promise<AiTranslationRow> {
    const refBig = parseEntityId(input.refId)
    const [existing] = await this.db
      .select()
      .from(aiTranslations)
      .where(
        and(
          eq(aiTranslations.refId, refBig),
          eq(aiTranslations.refType, input.refType),
          eq(aiTranslations.lang, input.lang),
        )!,
      )
      .limit(1)
    if (existing) {
      const [row] = await this.db
        .update(aiTranslations)
        .set({
          hash: input.hash,
          sourceLang: input.sourceLang,
          title: input.title,
          text: input.text,
          subtitle: input.subtitle,
          summary: input.summary,
          tags: input.tags,
          sourceModifiedAt: input.sourceModifiedAt,
          aiModel: input.aiModel,
          aiProvider: input.aiProvider,
          contentFormat: input.contentFormat,
          content: input.content,
          sourceBlockSnapshots: input.sourceBlockSnapshots,
          sourceMetaHashes: input.sourceMetaHashes,
        })
        .where(eq(aiTranslations.id, existing.id))
        .returning()
      return mapTranslation(row)
    }
    const id = this.snowflake.nextBigInt()
    const [row] = await this.db
      .insert(aiTranslations)
      .values({
        id,
        hash: input.hash,
        refId: refBig,
        refType: input.refType,
        lang: input.lang,
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
      })
      .returning()
    return mapTranslation(row)
  }

  async deleteForRef(
    refId: EntityId | string,
    refType: string,
  ): Promise<number> {
    const refBig = parseEntityId(refId)
    const result = await this.db
      .delete(aiTranslations)
      .where(
        and(
          eq(aiTranslations.refId, refBig),
          eq(aiTranslations.refType, refType),
        )!,
      )
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

  async lookup(
    keyPath: string,
    lang: string,
    keyType: string,
    lookupKey: string,
  ): Promise<TranslationEntryRow | null> {
    const [row] = await this.db
      .select()
      .from(translationEntries)
      .where(
        and(
          eq(translationEntries.keyPath, keyPath),
          eq(translationEntries.lang, lang),
          eq(translationEntries.keyType, keyType),
          eq(translationEntries.lookupKey, lookupKey),
        )!,
      )
      .limit(1)
    return row ? mapEntry(row) : null
  }

  async listByPathLang(
    keyPath: string,
    lang: string,
  ): Promise<TranslationEntryRow[]> {
    const rows = await this.db
      .select()
      .from(translationEntries)
      .where(
        and(
          eq(translationEntries.keyPath, keyPath),
          eq(translationEntries.lang, lang),
        )!,
      )
    return rows.map(mapEntry)
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
    const [existing] = await this.db
      .select()
      .from(translationEntries)
      .where(
        and(
          eq(translationEntries.keyPath, input.keyPath),
          eq(translationEntries.lang, input.lang),
          eq(translationEntries.keyType, input.keyType),
          eq(translationEntries.lookupKey, input.lookupKey),
        )!,
      )
      .limit(1)
    if (existing) {
      const [row] = await this.db
        .update(translationEntries)
        .set({
          sourceText: input.sourceText,
          translatedText: input.translatedText,
          sourceUpdatedAt: input.sourceUpdatedAt ?? existing.sourceUpdatedAt,
        })
        .where(eq(translationEntries.id, existing.id))
        .returning()
      return mapEntry(row)
    }
    const id = this.snowflake.nextBigInt()
    const [row] = await this.db
      .insert(translationEntries)
      .values({
        id,
        keyPath: input.keyPath,
        lang: input.lang,
        keyType: input.keyType,
        lookupKey: input.lookupKey,
        sourceText: input.sourceText,
        translatedText: input.translatedText,
        sourceUpdatedAt: input.sourceUpdatedAt ?? null,
      })
      .returning()
    return mapEntry(row)
  }

  async count(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(translationEntries)
    return Number(row?.count ?? 0)
  }
}
