import { Injectable, Logger } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'
import { ConfigsService } from '~/modules/configs/configs.service'

import { AiService } from '../ai.service'
import { AiTaskService } from '../ai-task/ai-task.service'
import { AITaskType } from '../ai-task/ai-task.types'
import {
  AI_MEMORY_DEFAULT_RECALL_MIN_SIMILARITY,
  AI_MEMORY_DEFAULT_RECALL_TOP_K,
} from './ai-memory.constants'
import {
  AiMemoryRepository,
  type ListMemoryFilters,
} from './ai-memory.repository'
import type {
  CreateMemoryInput,
  ListMemoryQueryInput,
  UpdateMemoryInput,
} from './ai-memory.schema'
import type {
  AiMemory,
  AiMemoryStatus,
  RecallOptions,
  RecallScoredMemory,
} from './ai-memory.types'

@Injectable()
export class AiMemoryService {
  private readonly logger = new Logger(AiMemoryService.name)

  constructor(
    private readonly repository: AiMemoryRepository,
    private readonly aiTaskService: AiTaskService,
    private readonly aiService: AiService,
    private readonly configService: ConfigsService,
  ) {}

  async list(query: ListMemoryQueryInput) {
    const filters: ListMemoryFilters = {
      scope: query.scope,
      type: query.type,
      status: query.status,
    }
    return this.repository.list(filters, query.page, query.size)
  }

  async findById(id: string): Promise<AiMemory> {
    const row = await this.repository.findById(id)
    if (!row) {
      throw createAppException(AppErrorCode.AI_MEMORY_NOT_FOUND, { id })
    }
    return row
  }

  async create(input: CreateMemoryInput, actorId: string): Promise<AiMemory> {
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null
    const created = await this.repository.create({
      scope: input.scope,
      type: input.type,
      content: input.content,
      confidence: input.confidence,
      salience: input.salience,
      expiresAt,
      metadata: input.metadata,
      source: { kind: 'manual', authorId: actorId },
    })
    await this.enqueueEmbed(created.id)
    return created
  }

  async update(
    id: string,
    input: UpdateMemoryInput,
    _actorId: string,
  ): Promise<AiMemory> {
    const existing = await this.findById(id)
    const expiresAt =
      input.expiresAt === undefined
        ? undefined
        : input.expiresAt === null
          ? null
          : new Date(input.expiresAt)
    const updated = await this.repository.update(id, {
      scope: input.scope,
      type: input.type,
      content: input.content,
      confidence: input.confidence,
      salience: input.salience,
      expiresAt,
      metadata: input.metadata,
    })
    if (!updated) {
      throw createAppException(AppErrorCode.AI_MEMORY_NOT_FOUND, { id })
    }
    const contentChanged =
      input.content !== undefined && input.content !== existing.content
    if (contentChanged) {
      await this.enqueueEmbed(updated.id)
    }
    return updated
  }

  async archive(id: string): Promise<void> {
    const updated = await this.repository.setStatus(id, 'archived')
    if (!updated) {
      throw createAppException(AppErrorCode.AI_MEMORY_NOT_FOUND, { id })
    }
  }

  async recall(opts: RecallOptions): Promise<RecallScoredMemory[]> {
    const scopes = Array.isArray(opts.scope) ? opts.scope : [opts.scope]
    if (!scopes.length) return []
    const memoryConfig = await this.getMemoryConfig()
    const topK = opts.topK ?? memoryConfig.recallTopK
    const minSimilarity = opts.minSimilarity ?? memoryConfig.recallMinSimilarity

    if (!opts.query) {
      const rows = await this.repository.listActiveByScope(scopes, topK)
      return rows.map((row) => ({ ...row }))
    }

    const runtime = await this.tryGetEmbeddingRuntime()
    if (!runtime) return []

    let queryVec: number[]
    let modelId: string
    try {
      const result = await runtime.embedBatch!({ inputs: [opts.query] })
      queryVec = result.vectors[0]
      modelId = result.model
    } catch (error) {
      this.logger.warn(
        `Memory recall embed failed: ${(error as Error).message}`,
      )
      return []
    }

    if (!queryVec?.length) return []

    const candidates = await this.repository.vectorSearch(
      scopes,
      queryVec,
      modelId,
      Math.max(1, topK * 2),
    )

    return candidates
      .filter((row) => (row.similarity ?? 0) >= minSimilarity)
      .map((row) => ({
        ...row,
        score: (row.similarity ?? 0) * row.salience * row.confidence,
      }))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, topK)
  }

  async totalActive(): Promise<number> {
    return this.repository.totalActive()
  }

  async getKpi(): Promise<{
    total: number
    active: number
    archived: number
  }> {
    const counts = await this.repository.countByStatus()
    const total = (Object.values(counts) as number[]).reduce(
      (sum, n) => sum + n,
      0,
    )
    return {
      total,
      active: counts.active ?? 0,
      archived: counts.archived ?? 0,
    }
  }

  async handleEmbedTask(memoryId: string): Promise<void> {
    const row = await this.repository.findById(memoryId)
    if (!row) return
    const allowed: AiMemoryStatus[] = ['active', 'pending_review']
    if (!allowed.includes(row.status)) return

    const runtime = await this.tryGetEmbeddingRuntime()
    if (!runtime) return

    try {
      const result = await runtime.embedBatch!({ inputs: [row.content] })
      const vec = result.vectors[0]
      if (!vec?.length) return
      await this.repository.updateEmbedding(memoryId, vec, result.model)
    } catch (error) {
      this.logger.warn(
        `Memory embed task failed for ${memoryId}: ${(error as Error).message}`,
      )
    }
  }

  private async enqueueEmbed(memoryId: string): Promise<void> {
    try {
      await this.aiTaskService.crud.createTask({
        type: AITaskType.MemoryEmbed,
        payload: { memoryId } as unknown as Record<string, unknown>,
        dedupKey: `memory:embed:${memoryId}`,
      })
    } catch (error) {
      this.logger.warn(
        `Failed to enqueue MEMORY_EMBED task for ${memoryId}: ${(error as Error).message}`,
      )
    }
  }

  private async tryGetEmbeddingRuntime() {
    try {
      const runtime = await this.aiService.getEmbeddingModel()
      if (!runtime?.embedBatch) return null
      return runtime
    } catch {
      return null
    }
  }

  private async getMemoryConfig(): Promise<{
    recallTopK: number
    recallMinSimilarity: number
  }> {
    try {
      const aiConfig = await this.configService.get('ai')
      const cfg = aiConfig?.aiMemory
      return {
        recallTopK: cfg?.recallTopK ?? AI_MEMORY_DEFAULT_RECALL_TOP_K,
        recallMinSimilarity:
          cfg?.recallMinSimilarity ?? AI_MEMORY_DEFAULT_RECALL_MIN_SIMILARITY,
      }
    } catch {
      return {
        recallTopK: AI_MEMORY_DEFAULT_RECALL_TOP_K,
        recallMinSimilarity: AI_MEMORY_DEFAULT_RECALL_MIN_SIMILARITY,
      }
    }
  }
}
