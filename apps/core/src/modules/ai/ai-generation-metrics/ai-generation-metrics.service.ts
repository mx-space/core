import { Injectable, Logger } from '@nestjs/common'

import { AiGenerationMetricsRepository } from './ai-generation-metrics.repository'
import type {
  AiGenerationResourceType,
  GenerationMetricsDto,
  GenerationUsage,
  RecordGenerationMetricsInput,
} from './ai-generation-metrics.types'
import { toGenerationMetricsDto } from './ai-generation-metrics.types'

@Injectable()
export class AiGenerationMetricsService {
  private readonly logger = new Logger(AiGenerationMetricsService.name)

  constructor(private readonly repository: AiGenerationMetricsRepository) {}

  async record(input: RecordGenerationMetricsInput): Promise<void> {
    try {
      await this.repository.insert(input)
    } catch (error) {
      this.logger.warn(
        `failed to record generation metrics type=${input.resourceType} resource=${input.resourceId}: ${(error as Error).message}`,
      )
    }
  }

  async latestByResources(
    resourceType: AiGenerationResourceType,
    resourceIds: string[],
  ): Promise<Map<string, GenerationMetricsDto>> {
    const rows = await this.repository.latestByResources(
      resourceType,
      resourceIds,
    )
    const map = new Map<string, GenerationMetricsDto>()
    for (const [id, row] of rows) {
      map.set(id, toGenerationMetricsDto(row))
    }
    return map
  }

  async attachLatest<T extends { id: string }>(
    resourceType: AiGenerationResourceType,
    items: T[],
  ): Promise<Array<T & { generationMetrics: GenerationMetricsDto | null }>> {
    if (!items.length) {
      return items.map((item) => ({ ...item, generationMetrics: null }))
    }
    const metrics = await this.latestByResources(
      resourceType,
      items.map((item) => item.id),
    )
    return items.map((item) => ({
      ...item,
      generationMetrics: metrics.get(item.id) ?? null,
    }))
  }

  async deleteByResource(
    resourceType: AiGenerationResourceType,
    resourceId: string,
  ): Promise<void> {
    await this.repository.deleteByResource(resourceType, resourceId)
  }

  async findLatestModel(
    resourceType: AiGenerationResourceType,
    resourceId: string,
  ): Promise<string | undefined> {
    const row = await this.repository.findLatest(resourceType, resourceId)
    return row?.model ?? undefined
  }

  async recordFromRuntime(args: {
    resourceType: AiGenerationResourceType
    resourceId: string
    refId: string
    lang?: string | null
    taskId?: string | null
    providerId?: string | null
    model?: string | null
    usage?: GenerationUsage | null
  }): Promise<void> {
    await this.record(args)
  }
}
