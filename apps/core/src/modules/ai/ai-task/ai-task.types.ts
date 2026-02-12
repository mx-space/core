export enum AITaskType {
  Summary = 'ai:summary',
  Translation = 'ai:translation',
  TranslationBatch = 'ai:translation:batch',
  TranslationAll = 'ai:translation:all',
}

export interface SummaryTaskPayload {
  refId: string
  lang?: string
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

export type AITaskPayload =
  | SummaryTaskPayload
  | TranslationTaskPayload
  | TranslationBatchTaskPayload
  | TranslationAllTaskPayload

export function computeAITaskDedupKey(
  type: AITaskType,
  payload: AITaskPayload,
): string {
  switch (type) {
    case AITaskType.Summary: {
      const p = payload as SummaryTaskPayload
      return `${p.refId}:${p.lang || 'default'}`
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
  }
}
