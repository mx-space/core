export enum AITaskType {
  Summary = 'ai:summary',
  Translation = 'ai:translation',
  TranslationBatch = 'ai:translation:batch',
  TranslationAll = 'ai:translation:all',
  SlugBackfill = 'ai:slug:backfill',
  Insights = 'ai:insights',
  InsightsTranslation = 'ai:insights:translation',
  EmbedSync = 'ai:embed:sync',
  EmbedBackfill = 'ai:embed:backfill',
  PersonaDistill = 'ai:persona:distill',
  MemoryEmbed = 'ai:memory:embed',
  EchoGenerate = 'ai:echo:generate',
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

export interface EmbedSyncTaskPayload {
  sourceType: string
  sourceId: string
  op: 'upsert' | 'delete'
}

export interface EmbedBackfillTaskPayload {
  sourceTypes?: string[]
  batchSize?: number
}

export interface PersonaDistillTaskPayload {
  personaKey: string
}

export interface MemoryEmbedTaskPayload {
  memoryId: string
}

export interface EchoGenerateTaskPayload {
  echoId: string
}

export type AITaskPayload =
  | SummaryTaskPayload
  | TranslationTaskPayload
  | TranslationBatchTaskPayload
  | TranslationAllTaskPayload
  | SlugBackfillTaskPayload
  | InsightsTaskPayload
  | InsightsTranslationTaskPayload
  | EmbedSyncTaskPayload
  | EmbedBackfillTaskPayload
  | PersonaDistillTaskPayload
  | MemoryEmbedTaskPayload
  | EchoGenerateTaskPayload

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
    case AITaskType.EmbedSync: {
      const p = payload as EmbedSyncTaskPayload
      return `embed:${p.sourceType}:${p.sourceId}:${p.op}`
    }
    case AITaskType.EmbedBackfill: {
      const p = payload as EmbedBackfillTaskPayload
      return `embed:backfill:${(p.sourceTypes || []).slice().sort().join(',')}`
    }
    case AITaskType.PersonaDistill: {
      const p = payload as PersonaDistillTaskPayload
      return `persona:distill:${p.personaKey}`
    }
    case AITaskType.MemoryEmbed: {
      const p = payload as MemoryEmbedTaskPayload
      return `memory:embed:${p.memoryId}`
    }
    case AITaskType.EchoGenerate: {
      const p = payload as EchoGenerateTaskPayload
      return `echo:generate:${p.echoId}`
    }
  }
}
