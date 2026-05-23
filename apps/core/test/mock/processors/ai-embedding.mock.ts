import { createHash } from 'node:crypto'

import type {
  EmbedBatchOptions,
  EmbedBatchResult,
} from '~/modules/ai/runtime/types'

const MOCK_MODEL_ID = 'mock-embedding-model'
const MOCK_DIM = 8

export function deterministicEmbedding(text: string): number[] {
  const digest = createHash('sha256').update(text).digest()
  const vector: number[] = []
  for (let i = 0; i < MOCK_DIM; i++) {
    const byte = digest[i] ?? 0
    vector.push((byte / 255) * 2 - 1)
  }
  const norm = Math.hypot(...vector) || 1
  return vector.map((value) => value / norm)
}

export function createMockEmbeddingRuntime() {
  return {
    providerInfo: {
      id: 'mock-embedding-provider',
      type: 'openai-compatible' as const,
      model: MOCK_MODEL_ID,
    },
    async embedBatch({ inputs }: EmbedBatchOptions): Promise<EmbedBatchResult> {
      const vectors = inputs.map((input) => deterministicEmbedding(input))
      return { vectors, model: MOCK_MODEL_ID, dim: MOCK_DIM }
    },
    async generateText() {
      throw new Error('mock embedding runtime does not support generateText')
    },
    async generateStructured() {
      throw new Error(
        'mock embedding runtime does not support generateStructured',
      )
    },
  }
}
