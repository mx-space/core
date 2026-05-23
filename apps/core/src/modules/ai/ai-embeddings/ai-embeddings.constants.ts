export const EMBEDDINGS_DEFAULTS = {
  chunkMaxTokens: 500,
  chunkOverlapTokens: 50,
  backfillBatchSize: 50,
  defaultMinSimilarity: 0.7,
  defaultTopK: 5,
} as const

export const SUPPORTED_SOURCE_TYPES = ['post', 'note', 'page'] as const

export type SupportedSourceType = (typeof SUPPORTED_SOURCE_TYPES)[number]
