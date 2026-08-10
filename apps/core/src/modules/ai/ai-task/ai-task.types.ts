import { normalizeTargetLangs, parseLanguageCode } from '../ai-language.util'

function canonicalTargetLangs(langs?: string[]): string {
  return normalizeTargetLangs(langs).sort().join(',')
}

export enum AITaskType {
  Summary = 'ai:summary',
  SummaryTranslation = 'ai:summary:translation',
  Translation = 'ai:translation',
  TranslationBatch = 'ai:translation:batch',
  TranslationAll = 'ai:translation:all',
  SlugBackfill = 'ai:slug:backfill',
  Insights = 'ai:insights',
  InsightsTranslation = 'ai:insights:translation',
  ImageGeneration = 'ai:image:generation',
  Tts = 'ai:tts',
}

export interface SummaryTaskPayload {
  refId: string
  targetLanguages?: string[]
  force?: boolean
  // Human-readable info
  title?: string
  refType?: string
}

export interface SummaryTranslationTaskPayload {
  refId: string
  sourceSummaryId: string
  targetLang: string
  force?: boolean
  title?: string
  refType?: string
}

export interface TranslationTaskPayload {
  refId: string
  targetLanguages?: string[]
  force?: boolean
  // Human-readable info
  title?: string
  refType?: string
}

export interface TranslationBatchTaskPayload {
  refIds: string[]
  targetLanguages?: string[]
  // Human-readable info (count is derived from refIds.length)
}

export interface TranslationAllTaskPayload {
  targetLanguages?: string[]
  // Human-readable info
  articleCount?: number
}

export interface SlugBackfillTaskPayload {
  // Human-readable info
  noteCount?: number
  noteIds?: string[]
}

export interface InsightsTaskPayload {
  refId: string
  force?: boolean
  /** Languages to translate the generated insights into once it exists. */
  targetLanguages?: string[]
  title?: string
  refType?: string
}

export interface InsightsTranslationTaskPayload {
  refId: string
  sourceInsightsId: string
  targetLang: string
  force?: boolean
  title?: string
  refType?: string
}

export interface ImageGenerationTaskPayload {
  prompt?: string
  presetId?: string
  purpose: 'cover' | 'inline'
  aspectRatio?: string
  quality?: string
  format?: string
  model?: string
  providerParams?: Record<string, unknown>
  refId?: string
  draftId?: string
  title?: string
  summary?: string
  requestId: string
}

export interface TtsTaskPayload {
  refId: string
  langs?: string[]
  force?: boolean
  title?: string
  refType?: string
}

export type AITaskPayload =
  | SummaryTaskPayload
  | SummaryTranslationTaskPayload
  | TranslationTaskPayload
  | TranslationBatchTaskPayload
  | TranslationAllTaskPayload
  | SlugBackfillTaskPayload
  | InsightsTaskPayload
  | InsightsTranslationTaskPayload
  | ImageGenerationTaskPayload
  | TtsTaskPayload

export function computeAITaskDedupKey(
  type: AITaskType,
  payload: AITaskPayload,
): string {
  switch (type) {
    case AITaskType.Summary: {
      const p = payload as SummaryTaskPayload
      // Canonicalize like the handler does — zh-CN and zh generate the same
      // result, so they must dedup to the same task instead of running twice.
      const langs = canonicalTargetLangs(p.targetLanguages)
      return `${p.refId}:${p.force ? 'force' : 'inc'}:${langs}`
    }
    case AITaskType.Translation: {
      const p = payload as TranslationTaskPayload
      const langs = canonicalTargetLangs(p.targetLanguages)
      return `${p.refId}:${p.force ? 'force' : 'inc'}:${langs}`
    }
    case AITaskType.TranslationBatch: {
      const p = payload as TranslationBatchTaskPayload
      return `${(p.refIds || []).slice().sort().join(',')}:${(p.targetLanguages || []).slice().sort().join(',')}`
    }
    case AITaskType.TranslationAll: {
      const p = payload as TranslationAllTaskPayload
      return `all:${(p.targetLanguages || []).slice().sort().join(',')}`
    }
    case AITaskType.SlugBackfill: {
      const p = payload as SlugBackfillTaskPayload
      if (p.noteIds?.length) {
        return `slug:backfill:${p.noteIds.slice().sort().join(',')}`
      }
      return `slug:backfill`
    }
    case AITaskType.Insights: {
      const p = payload as InsightsTaskPayload
      const langs = canonicalTargetLangs(p.targetLanguages)
      return `${p.refId}:${p.force ? 'force' : 'inc'}:${langs}`
    }
    case AITaskType.SummaryTranslation: {
      const p = payload as SummaryTranslationTaskPayload
      return `${p.refId}:${p.targetLang}:${p.force ? 'force' : 'inc'}`
    }
    case AITaskType.InsightsTranslation: {
      const p = payload as InsightsTranslationTaskPayload
      return `${p.refId}:${p.targetLang}:${p.force ? 'force' : 'inc'}`
    }
    case AITaskType.ImageGeneration: {
      // Deliberately opts out of dedup: generating several images from the
      // same prompt to pick between them is the normal workflow, so the key
      // must be unique per request rather than per (semantic) payload.
      const p = payload as ImageGenerationTaskPayload
      return `${p.requestId}`
    }
    case AITaskType.Tts: {
      const p = payload as TtsTaskPayload
      // The handler locks on canonical (refId, lang), so the dedup key has to
      // canonicalize too — otherwise `zh-CN` and `zh` enqueue two tasks and the
      // one that loses the lock reports success having generated nothing.
      const langs = [
        ...new Set((p.langs || []).map((lang) => parseLanguageCode(lang))),
      ]
        .sort()
        .join(',')
      return `${p.refId}:${p.force ? 'force' : 'inc'}:${langs}`
    }
  }
}
