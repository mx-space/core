export enum AITaskType {
  Summary = 'ai:summary',
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
  // Human-readable info
  title?: string
  refType?: string
}

export interface TranslationTaskPayload {
  refId: string
  targetLanguages?: string[]
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
  title?: string
  refType?: string
}

export interface InsightsTranslationTaskPayload {
  refId: string
  sourceInsightsId: string
  targetLang: string
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
      return `${p.refId}:${(p.targetLanguages || []).slice().sort().join(',')}`
    }
    case AITaskType.Translation: {
      const p = payload as TranslationTaskPayload
      return `${p.refId}:${(p.targetLanguages || []).slice().sort().join(',')}`
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
      return `${p.refId}`
    }
    case AITaskType.InsightsTranslation: {
      const p = payload as InsightsTranslationTaskPayload
      return `${p.refId}:${p.targetLang}`
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
      const langs = (p.langs || []).slice().sort().join(',')
      return `${p.refId}:${p.force ? 'force' : 'inc'}:${langs}`
    }
  }
}
