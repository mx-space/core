import type { Effect } from 'effect'

import type {
  AiRecordNotFound,
  AiTaskCreateFailed,
  AiTaskFailed,
} from '../../domain/errors'
import type { ApiError } from '../Api'

export type AiTaskType =
  | 'summary'
  | 'summary_translation'
  | 'translation'
  | 'insights'
  | 'insights_translation'
  | 'tts'

export type AiTaskStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'completed'
  | 'partial_failed'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

export interface AiTaskCreateResult {
  readonly taskId: string
  readonly created: boolean
  readonly type: AiTaskType
  readonly refId: string
  readonly targetLanguages?: ReadonlyArray<string>
}

export interface AiTaskFinalView {
  readonly type: AiTaskType
  readonly taskId: string
  readonly status: AiTaskStatus
  readonly refId?: string
  readonly targetLanguages?: ReadonlyArray<string>
  readonly totalTokens?: number
  readonly totalCost?: number
  readonly resultIds?: ReadonlyArray<string>
  readonly error?: { readonly message: string }
}

export interface AiTaskCreateInput {
  readonly refId: string
  readonly targetLanguages?: ReadonlyArray<string>
  readonly force?: boolean
}

export interface AiTaskTranslateInput {
  readonly refId: string
  readonly targetLanguages: ReadonlyArray<string>
  readonly force?: boolean
}

export interface AiSingleTranslateInput {
  readonly refId: string
  readonly targetLang: string
  readonly force?: boolean
}

export interface AiWaitOptions {
  readonly type: AiTaskType
  readonly pollMs?: number
  /** Stderr progress emitter; receives a transition message per state change. */
  readonly onProgress?: (message: string) => void
}

export interface AiListQuery {
  readonly page?: number
  readonly size?: number
  readonly grouped?: boolean
  readonly search?: string
}

export interface AiVoicesQuery {
  readonly providerId: string
  readonly model: string
}

export type AiOverviewType = 'post' | 'note' | 'page'

export interface AiOverviewListQuery {
  readonly page?: number
  readonly size?: number
  readonly search?: string
  readonly type?: AiOverviewType
}

export interface AiEntryListQuery {
  readonly page?: number
  readonly size?: number
  readonly keyPath?: string
  readonly lang?: string
}

export interface AiEntryGenerateInput {
  readonly keyPaths?: ReadonlyArray<string>
  readonly targetLangs?: ReadonlyArray<string>
}

export interface AiSummaryPatch {
  readonly summary: string
}

export interface AiInsightsPatch {
  readonly content: string
}

export interface AiTranslationPatch {
  title?: string
  text?: string
  subtitle?: string | null
  summary?: string
  tags?: ReadonlyArray<string>
  content?: string
}

export interface AiEntryPatch {
  readonly translatedText: string
}

export interface AiByArticleOptions {
  readonly lang?: string
  readonly onlyDb?: boolean
}

export type AiServiceError =
  | ApiError
  | AiTaskCreateFailed
  | AiTaskFailed
  | AiRecordNotFound

export interface AiService {
  // -- generate ------------------------------------------------------------
  readonly regenSummary: (
    input: AiTaskCreateInput,
  ) => Effect.Effect<AiTaskCreateResult, AiTaskCreateFailed | ApiError>
  readonly translate: (
    input: AiTaskTranslateInput,
  ) => Effect.Effect<AiTaskCreateResult, AiTaskCreateFailed | ApiError>
  readonly refreshInsights: (
    input: AiTaskCreateInput,
  ) => Effect.Effect<AiTaskCreateResult, AiTaskCreateFailed | ApiError>
  readonly translateSummary: (
    input: AiSingleTranslateInput,
  ) => Effect.Effect<AiTaskCreateResult, AiTaskCreateFailed | ApiError>
  readonly translateInsights: (
    input: AiSingleTranslateInput,
  ) => Effect.Effect<AiTaskCreateResult, AiTaskCreateFailed | ApiError>
  readonly runTts: (
    input: AiTaskCreateInput,
  ) => Effect.Effect<AiTaskCreateResult, AiTaskCreateFailed | ApiError>
  readonly waitForTask: (
    taskId: string,
    options: AiWaitOptions,
  ) => Effect.Effect<AiTaskFinalView, AiTaskFailed | ApiError>

  // -- summary read/manage -------------------------------------------------
  readonly listSummaries: (q: AiListQuery) => Effect.Effect<unknown, ApiError>
  readonly getSummary: (
    id: string,
  ) => Effect.Effect<unknown, AiRecordNotFound | ApiError>
  readonly getSummariesByArticle: (
    refId: string,
    opts?: AiByArticleOptions,
  ) => Effect.Effect<unknown, ApiError>
  readonly updateSummary: (
    id: string,
    patch: AiSummaryPatch,
  ) => Effect.Effect<unknown, ApiError>
  readonly deleteSummary: (id: string) => Effect.Effect<void, ApiError>

  // -- translation read/manage --------------------------------------------
  readonly listTranslations: (
    q: AiListQuery,
  ) => Effect.Effect<unknown, ApiError>
  readonly getTranslation: (
    id: string,
  ) => Effect.Effect<unknown, AiRecordNotFound | ApiError>
  readonly getTranslationsByArticle: (
    refId: string,
    opts?: AiByArticleOptions,
  ) => Effect.Effect<unknown, ApiError>
  readonly getTranslationLanguages: (
    refId: string,
  ) => Effect.Effect<unknown, ApiError>
  readonly updateTranslation: (
    id: string,
    patch: AiTranslationPatch,
  ) => Effect.Effect<unknown, ApiError>
  readonly deleteTranslation: (id: string) => Effect.Effect<void, ApiError>

  // -- insights read/manage -----------------------------------------------
  readonly listInsights: (q: AiListQuery) => Effect.Effect<unknown, ApiError>
  readonly getInsights: (
    id: string,
  ) => Effect.Effect<unknown, AiRecordNotFound | ApiError>
  readonly getInsightsByArticle: (
    refId: string,
    opts?: AiByArticleOptions,
  ) => Effect.Effect<unknown, ApiError>
  readonly updateInsights: (
    id: string,
    patch: AiInsightsPatch,
  ) => Effect.Effect<unknown, ApiError>
  readonly deleteInsights: (id: string) => Effect.Effect<void, ApiError>

  // -- tts -------------------------------------------------------------------
  readonly listTts: (q: AiListQuery) => Effect.Effect<unknown, ApiError>
  readonly getTtsByArticle: (refId: string) => Effect.Effect<unknown, ApiError>
  readonly discoverTtsVoices: (
    q: AiVoicesQuery,
  ) => Effect.Effect<unknown, ApiError>
  readonly deleteTts: (id: string) => Effect.Effect<void, ApiError>

  // -- overview -------------------------------------------------------------
  readonly listOverview: (
    q: AiOverviewListQuery,
  ) => Effect.Effect<unknown, ApiError>
  readonly getOverviewByArticle: (
    refId: string,
  ) => Effect.Effect<unknown, ApiError>

  // -- translation entries ------------------------------------------------
  readonly listEntries: (
    q: AiEntryListQuery,
  ) => Effect.Effect<unknown, ApiError>
  readonly generateEntries: (
    input: AiEntryGenerateInput,
  ) => Effect.Effect<unknown, ApiError>
  readonly updateEntry: (
    id: string,
    patch: AiEntryPatch,
  ) => Effect.Effect<unknown, ApiError>
  readonly deleteEntry: (id: string) => Effect.Effect<void, ApiError>
}
