export interface PlannedChunk {
  blockId: string
  chunkIndex: number
  type: string
  text: string
  fingerprint: string
}

export interface ExistingBlockRow {
  id: string
  blockId: string
  chunkIndex: number
  fingerprint: string
  storageBackend: 's3' | 'local'
  storageKey: string
}

export interface TtsPlan {
  toGenerate: PlannedChunk[]
  toReuse: Array<{ rowId: string; blockId: string; chunkIndex: number }>
  toDelete: Array<{
    rowId: string
    storageBackend: 's3' | 'local'
    storageKey: string
  }>
  blockOrder: string[]
  charCount: number
}

export interface PlanTtsInput {
  chunks: PlannedChunk[]
  existing: ExistingBlockRow[]
  force: boolean
  /**
   * The object key this run would write for a chunk. It folds in the run's
   * voice triple, so comparing it against `row.storageKey` is what stops a
   * `force` run that died partway from leaving mixed-voice audio behind.
   */
  objectKeyFor: (chunk: PlannedChunk) => string
}

export interface AiTtsRow {
  id: string
  createdAt: Date
  updatedAt: Date | null
  refId: string
  lang: string
  isTranslation: boolean
  sourceLang: string | null
  model: string
  voice: string
  speed: number
  format: string
  blockOrder: string[]
  charCount: number
  totalDurationMs: number | null
  sourceModifiedAt: Date | null
}

export interface AiTtsBlockRow {
  id: string
  createdAt: Date
  ttsId: string
  blockId: string
  fingerprint: string
  chunkIndex: number
  text: string
  url: string
  storageBackend: 's3' | 'local'
  storageKey: string
  byteSize: number | null
  durationMs: number | null
}

export interface AiTtsMeta {
  id: string
  updatedAt: Date | null
  blockCount: number
  sourceModifiedAt: Date | null
}

export interface UpsertParentInput {
  refId: string
  lang: string
  isTranslation: boolean
  sourceLang: string | null
  model: string
  voice: string
  speed: number
  format: string
  blockOrder: string[]
  charCount: number
  sourceModifiedAt: Date | null
}

export interface TtsSourceDocument {
  title: string
  text: string
  subtitle?: string | null
  summary?: string | null
  tags?: string[]
  contentFormat?: string | null
  content?: string | null
  meta?: Record<string, unknown> | null
  modifiedAt?: Date | null
}

export interface TtsStoredObject {
  storageBackend: 's3' | 'local'
  storageKey: string
}

export interface TtsVoiceConfig {
  model: string
  voice: string
  speed: number
}

export interface TtsProviderConfig {
  provider: string
  apiKey: string
  endpoint?: string
  projectId?: string
  providerType?: import('../ai.types').AIProviderType
}

export interface TtsLanguageResult {
  lang: string
  ttsId: string
  total: number
  generated: number
  reused: number
  deleted: number
  charCount: number
  requeued?: boolean
}

export interface UpsertBlockInput {
  ttsId: string
  blockId: string
  chunkIndex: number
  fingerprint: string
  text: string
  url: string
  storageBackend: 's3' | 'local'
  storageKey: string
  byteSize?: number | null
  durationMs?: number | null
}
