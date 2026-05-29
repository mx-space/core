import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'
import { PG_DB_TOKEN } from '~/constants/system.constant'
import { DatabaseService } from '~/processors/database/database.service'
import type { AppDatabase } from '~/processors/database/postgres.provider'

import { ConfigsService } from '../../configs/configs.service'
import { AiService } from '../ai.service'
import { AIFeatureKey } from '../ai.types'
import { EMBEDDINGS_DEFAULTS } from './ai-embeddings.constants'
import { AiEmbeddingsRepository } from './ai-embeddings.repository'
import type {
  EmbeddingStats,
  RetrievalResult,
  SearchOptions,
} from './ai-embeddings.types'
import { chunk } from './chunker'
import {
  type BackfillOptions,
  type BackfillSummary,
  runCorpusBackfill,
} from './tasks/corpus-backfill.driver'

interface ResolvedEmbeddingParams {
  chunkMaxTokens: number
  chunkOverlapTokens: number
  backfillBatchSize: number
  defaultMinSimilarity: number
  defaultTopK: number
}

@Injectable()
export class AiEmbeddingsService {
  private readonly logger = new Logger(AiEmbeddingsService.name)

  constructor(
    private readonly repository: AiEmbeddingsRepository,
    private readonly configService: ConfigsService,
    @Inject(forwardRef(() => AiService))
    private readonly aiService: AiService,
    private readonly databaseService: DatabaseService,
    @Inject(PG_DB_TOKEN) private readonly db: AppDatabase,
  ) {}

  async runBackfill(options: BackfillOptions = {}): Promise<BackfillSummary> {
    return runCorpusBackfill(this, this.db, options)
  }

  async resolveParams(): Promise<ResolvedEmbeddingParams> {
    const aiConfig = await this.configService.get('ai')
    const params = aiConfig.aiEmbedding ?? {}
    return {
      chunkMaxTokens:
        params.chunkMaxTokens ?? EMBEDDINGS_DEFAULTS.chunkMaxTokens,
      chunkOverlapTokens:
        params.chunkOverlapTokens ?? EMBEDDINGS_DEFAULTS.chunkOverlapTokens,
      backfillBatchSize:
        params.backfillBatchSize ?? EMBEDDINGS_DEFAULTS.backfillBatchSize,
      defaultMinSimilarity:
        params.defaultMinSimilarity ?? EMBEDDINGS_DEFAULTS.defaultMinSimilarity,
      defaultTopK: params.defaultTopK ?? EMBEDDINGS_DEFAULTS.defaultTopK,
    }
  }

  async isEmbeddingConfigured(): Promise<boolean> {
    return this.aiService.hasFeatureModel(AIFeatureKey.Embedding)
  }

  async embedBatch(inputs: string[]): Promise<{
    vectors: number[][]
    model: string
    dim: number
  }> {
    if (inputs.length === 0) {
      return { vectors: [], model: '', dim: 0 }
    }
    const runtime = await this.aiService.getEmbeddingModel()
    if (!runtime.embedBatch) {
      throw createAppException(AppErrorCode.AI_EMBEDDING_MODEL_NOT_CONFIGURED)
    }
    try {
      const result = await runtime.embedBatch({ inputs })
      return result
    } catch (error) {
      throw createAppException(AppErrorCode.AI_EMBEDDING_BATCH_FAILED, {
        message: (error as Error)?.message,
      })
    }
  }

  async search(
    query: string,
    options: SearchOptions = {},
  ): Promise<RetrievalResult[]> {
    if (!query?.trim()) return []
    if (!(await this.isEmbeddingConfigured())) {
      throw createAppException(AppErrorCode.AI_EMBEDDING_MODEL_NOT_CONFIGURED)
    }
    const params = await this.resolveParams()
    const topK = options.topK ?? params.defaultTopK
    const minSimilarity = options.minSimilarity ?? params.defaultMinSimilarity

    const { vectors, model } = await this.embedBatch([query])
    if (vectors.length === 0) return []
    const effectiveModel = options.model ?? model

    const results = await this.repository.searchByVector(vectors[0], {
      embeddingModel: effectiveModel,
      topK,
      sourceTypes: options.sourceTypes,
    })

    return results.filter((r) => r.similarity >= minSimilarity)
  }

  async syncSource(
    sourceType: string,
    sourceId: string,
    op: 'upsert' | 'delete',
  ): Promise<{ deleted?: number; embedded?: number }> {
    if (op === 'delete') {
      const deleted = await this.repository.deleteBySource(sourceType, sourceId)
      return { deleted }
    }

    if (!(await this.isEmbeddingConfigured())) {
      this.logger.debug(
        `Embedding model unconfigured; skipping sync for ${sourceType}:${sourceId}`,
      )
      return {}
    }

    const source = await this.databaseService.findGlobalById(sourceId)
    if (!source || !source.document) return {}
    if (source.type !== sourceType) return {}

    const document = source.document as { text?: string; content?: string }
    const markdown = (document.text || document.content || '').trim()

    const params = await this.resolveParams()

    if (!markdown) {
      const deleted = await this.repository.deleteBySource(sourceType, sourceId)
      return { deleted }
    }

    const chunks = chunk(markdown, {
      maxTokens: params.chunkMaxTokens,
      overlapTokens: params.chunkOverlapTokens,
    })

    const runtime = await this.aiService.getEmbeddingModel()
    const modelId = runtime.providerInfo.model

    const existing = await this.repository.findBySource(
      sourceType,
      sourceId,
      modelId,
    )
    const existingByIndex = new Map(existing.map((e) => [e.chunkIndex, e]))

    const staleIndices = existing
      .map((e) => e.chunkIndex)
      .filter((i) => i >= chunks.length)
    let deleted = 0
    if (staleIndices.length > 0) {
      deleted = await this.repository.deleteByIndices(
        sourceType,
        sourceId,
        modelId,
        staleIndices,
      )
    }

    const toEmbed = chunks.filter(
      (c) => existingByIndex.get(c.index)?.contentHash !== c.hash,
    )

    if (toEmbed.length === 0) {
      return { deleted, embedded: 0 }
    }

    const { vectors, model, dim } = await this.embedBatch(
      toEmbed.map((c) => c.content),
    )
    const effectiveModel = model || modelId

    const embedded = await this.repository.upsertChunks(
      toEmbed.map((c, i) => ({
        sourceType,
        sourceId,
        chunkIndex: c.index,
        content: c.content,
        contentHash: c.hash,
        embedding: vectors[i],
        embeddingModel: effectiveModel,
        dim: dim || vectors[i].length,
      })),
    )

    return { deleted, embedded }
  }

  async getStats(): Promise<EmbeddingStats> {
    return this.repository.stats()
  }
}
