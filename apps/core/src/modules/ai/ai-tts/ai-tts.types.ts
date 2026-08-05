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
