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
