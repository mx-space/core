import { Inject, Injectable } from '@nestjs/common'
import { desc, eq, inArray } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import {
  aiInsights,
  aiSummaries,
  aiTranslations,
  aiTts,
} from '~/database/schema'
import {
  BaseRepository,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { parseEntityId } from '~/shared/id/entity-id'

import { DEFAULT_SUMMARY_LANG } from '../ai.constants'
import type {
  InsightsAsset,
  SummaryAsset,
  TranslationAsset,
  TtsAsset,
} from './ai-overview.types'

export interface RefLang {
  refId: string
  lang: string
}

export interface RefTranslationLang extends RefLang {
  sourceLang: string
}

export interface CoverageRows {
  summary: RefLang[]
  insights: RefLang[]
  translation: RefTranslationLang[]
  tts: RefLang[]
}

const emptyCoverageRows = (): CoverageRows => ({
  summary: [],
  insights: [],
  translation: [],
  tts: [],
})

@Injectable()
export class AiOverviewRepository extends BaseRepository {
  constructor(@Inject(PG_DB_TOKEN) db: AppDatabase) {
    super(db)
  }

  /**
   * Narrow `(ref_id, lang)` projections for a single page of articles — the
   * only columns coverage judging needs. Reading full rows here would drag
   * whole Lexical documents across for a matrix that renders four ticks.
   */
  async coverageByRefIds(refIds: string[]): Promise<CoverageRows> {
    if (!refIds.length) return emptyCoverageRows()
    const ids = refIds.map((id) => parseEntityId(id))

    const [summary, insights, translation, tts] = await Promise.all([
      this.db
        .select({ refId: aiSummaries.refId, lang: aiSummaries.lang })
        .from(aiSummaries)
        .where(inArray(aiSummaries.refId, ids)),
      this.db
        .select({ refId: aiInsights.refId, lang: aiInsights.lang })
        .from(aiInsights)
        .where(inArray(aiInsights.refId, ids)),
      this.db
        .select({
          refId: aiTranslations.refId,
          lang: aiTranslations.lang,
          sourceLang: aiTranslations.sourceLang,
        })
        .from(aiTranslations)
        .where(inArray(aiTranslations.refId, ids)),
      this.db
        .select({ refId: aiTts.refId, lang: aiTts.lang })
        .from(aiTts)
        .where(inArray(aiTts.refId, ids)),
    ])

    return {
      // Legacy summaries predate the lang column; they were all Chinese.
      summary: summary.map((row) => ({
        refId: String(toEntityId(row.refId)),
        lang: row.lang ?? DEFAULT_SUMMARY_LANG,
      })),
      insights: insights.map((row) => ({
        refId: String(toEntityId(row.refId)),
        lang: row.lang,
      })),
      translation: translation.map((row) => ({
        refId: String(toEntityId(row.refId)),
        lang: row.lang,
        sourceLang: row.sourceLang,
      })),
      tts: tts.map((row) => ({
        refId: String(toEntityId(row.refId)),
        lang: row.lang,
      })),
    }
  }

  async summaryAssets(refId: string): Promise<SummaryAsset[]> {
    const rows = await this.db
      .select({
        id: aiSummaries.id,
        lang: aiSummaries.lang,
        summary: aiSummaries.summary,
        createdAt: aiSummaries.createdAt,
      })
      .from(aiSummaries)
      .where(eq(aiSummaries.refId, parseEntityId(refId)))
      .orderBy(desc(aiSummaries.createdAt))
    return rows.map((row) => ({
      id: String(toEntityId(row.id)),
      lang: row.lang ?? DEFAULT_SUMMARY_LANG,
      summary: row.summary,
      createdAt: row.createdAt,
    }))
  }

  async insightsAssets(refId: string): Promise<InsightsAsset[]> {
    const rows = await this.db
      .select({
        id: aiInsights.id,
        lang: aiInsights.lang,
        content: aiInsights.content,
        isTranslation: aiInsights.isTranslation,
        sourceLang: aiInsights.sourceLang,
        createdAt: aiInsights.createdAt,
      })
      .from(aiInsights)
      .where(eq(aiInsights.refId, parseEntityId(refId)))
      .orderBy(desc(aiInsights.createdAt))
    return rows.map((row) => ({
      id: String(toEntityId(row.id)),
      lang: row.lang,
      content: row.content,
      isTranslation: row.isTranslation,
      sourceLang: row.sourceLang,
      createdAt: row.createdAt,
    }))
  }

  /**
   * `content` is the whole translated Lexical document. The overview board is
   * read-only and links out to `/ai/translation/:refId` for editing, so the
   * column is deliberately absent from this projection.
   */
  async translationAssets(refId: string): Promise<TranslationAsset[]> {
    const rows = await this.db
      .select({
        id: aiTranslations.id,
        lang: aiTranslations.lang,
        sourceLang: aiTranslations.sourceLang,
        aiModel: aiTranslations.aiModel,
        createdAt: aiTranslations.createdAt,
        updatedAt: aiTranslations.updatedAt,
      })
      .from(aiTranslations)
      .where(eq(aiTranslations.refId, parseEntityId(refId)))
      .orderBy(desc(aiTranslations.createdAt))
    return rows.map((row) => ({
      id: String(toEntityId(row.id)),
      lang: row.lang,
      sourceLang: row.sourceLang,
      aiModel: row.aiModel,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }))
  }

  async ttsAssets(refId: string): Promise<TtsAsset[]> {
    const rows = await this.db
      .select({
        id: aiTts.id,
        lang: aiTts.lang,
        isTranslation: aiTts.isTranslation,
        charCount: aiTts.charCount,
        totalDurationMs: aiTts.totalDurationMs,
        createdAt: aiTts.createdAt,
        updatedAt: aiTts.updatedAt,
      })
      .from(aiTts)
      .where(eq(aiTts.refId, parseEntityId(refId)))
      .orderBy(desc(aiTts.createdAt))
    return rows.map((row) => ({
      id: String(toEntityId(row.id)),
      lang: row.lang,
      isTranslation: row.isTranslation,
      charCount: row.charCount,
      durationMs: row.totalDurationMs,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }))
  }
}
