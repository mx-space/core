export interface ChunkSpec {
  index: number
  content: string
  hash: string
}

export interface RetrievalResult {
  sourceType: string
  sourceId: string
  chunkIndex: number
  content: string
  distance: number
  similarity: number
}

export interface SearchOptions {
  topK?: number
  minSimilarity?: number
  model?: string
  sourceTypes?: string[]
}

export interface SyncOperation {
  sourceType: string
  sourceId: string
  op: 'upsert' | 'delete'
}

export interface CorpusEmbeddingRow {
  id: string
  sourceType: string
  sourceId: string
  chunkIndex: number
  content: string
  contentHash: string
  embedding: number[]
  embeddingModel: string
  dim: number
  createdAt: Date
}

export interface EmbeddingStats {
  total: number
  byModel: Array<{ model: string; dim: number; rows: number }>
  bySourceType: Array<{ type: string; rows: number }>
}
