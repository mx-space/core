import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'

import { PG_DB_TOKEN } from '~/constants/system.constant'
import { aiGenerationMetrics } from '~/database/schema'
import {
  BaseRepository,
  toEntityId,
} from '~/processors/database/base.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { type EntityId, parseEntityId } from '~/shared/id/entity-id'
import { SnowflakeService } from '~/shared/id/snowflake.service'

import type {
  AiGenerationMetricsRow,
  AiGenerationResourceType,
  RecordGenerationMetricsInput,
} from './ai-generation-metrics.types'
import {
  resolveCostTotalUsd,
  resolveTotalTokens,
} from './ai-generation-metrics.types'

const mapRow = (
  row: typeof aiGenerationMetrics.$inferSelect,
): AiGenerationMetricsRow => ({
  // Metrics row ids may be non-snowflake (migration backfill used
  // `${resourceId}:metrics`). Treat as opaque text — never surface as an API id.
  id: String(row.id) as EntityId,
  createdAt: row.createdAt,
  resourceType: row.resourceType as AiGenerationResourceType,
  resourceId: toEntityId(row.resourceId) as EntityId,
  refId: toEntityId(row.refId) as EntityId,
  lang: row.lang,
  taskId: row.taskId,
  providerId: row.providerId,
  model: row.model,
  inputTokens: row.inputTokens,
  outputTokens: row.outputTokens,
  cacheReadTokens: row.cacheReadTokens,
  cacheWriteTokens: row.cacheWriteTokens,
  totalTokens: row.totalTokens,
  costInputUsd: row.costInputUsd,
  costOutputUsd: row.costOutputUsd,
  costCacheReadUsd: row.costCacheReadUsd,
  costCacheWriteUsd: row.costCacheWriteUsd,
  costTotalUsd: row.costTotalUsd,
})

function nullableNumber(value: number | null | undefined): number | null {
  if (value == null) return null
  if (!Number.isFinite(value)) return null
  return value
}

@Injectable()
export class AiGenerationMetricsRepository extends BaseRepository {
  constructor(
    @Inject(PG_DB_TOKEN) db: AppDatabase,
    private readonly snowflake: SnowflakeService,
  ) {
    super(db)
  }

  async insert(
    input: RecordGenerationMetricsInput,
  ): Promise<AiGenerationMetricsRow> {
    const usage = input.usage ?? null
    const id = this.snowflake.nextId()
    const [row] = await this.db
      .insert(aiGenerationMetrics)
      .values({
        id,
        resourceType: input.resourceType,
        resourceId: parseEntityId(input.resourceId),
        refId: parseEntityId(input.refId),
        lang: input.lang ?? null,
        taskId: input.taskId ?? null,
        providerId: input.providerId ?? null,
        model: input.model ?? null,
        inputTokens: nullableNumber(usage?.inputTokens),
        outputTokens: nullableNumber(usage?.outputTokens),
        cacheReadTokens: nullableNumber(usage?.cacheReadTokens),
        cacheWriteTokens: nullableNumber(usage?.cacheWriteTokens),
        totalTokens: resolveTotalTokens(usage),
        costInputUsd: nullableNumber(usage?.cost?.input),
        costOutputUsd: nullableNumber(usage?.cost?.output),
        costCacheReadUsd: nullableNumber(usage?.cost?.cacheRead),
        costCacheWriteUsd: nullableNumber(usage?.cost?.cacheWrite),
        costTotalUsd: resolveCostTotalUsd(usage),
      })
      .returning()
    return mapRow(row)
  }

  async latestByResources(
    resourceType: AiGenerationResourceType,
    resourceIds: Array<EntityId | string>,
  ): Promise<Map<string, AiGenerationMetricsRow>> {
    const map = new Map<string, AiGenerationMetricsRow>()
    if (!resourceIds.length) return map

    const ids = resourceIds.map((id) => parseEntityId(id))
    const ranked = this.db
      .select({
        id: aiGenerationMetrics.id,
        createdAt: aiGenerationMetrics.createdAt,
        resourceType: aiGenerationMetrics.resourceType,
        resourceId: aiGenerationMetrics.resourceId,
        refId: aiGenerationMetrics.refId,
        lang: aiGenerationMetrics.lang,
        taskId: aiGenerationMetrics.taskId,
        providerId: aiGenerationMetrics.providerId,
        model: aiGenerationMetrics.model,
        inputTokens: aiGenerationMetrics.inputTokens,
        outputTokens: aiGenerationMetrics.outputTokens,
        cacheReadTokens: aiGenerationMetrics.cacheReadTokens,
        cacheWriteTokens: aiGenerationMetrics.cacheWriteTokens,
        totalTokens: aiGenerationMetrics.totalTokens,
        costInputUsd: aiGenerationMetrics.costInputUsd,
        costOutputUsd: aiGenerationMetrics.costOutputUsd,
        costCacheReadUsd: aiGenerationMetrics.costCacheReadUsd,
        costCacheWriteUsd: aiGenerationMetrics.costCacheWriteUsd,
        costTotalUsd: aiGenerationMetrics.costTotalUsd,
        rn: sql<number>`row_number() over (
          partition by ${aiGenerationMetrics.resourceId}
          order by ${aiGenerationMetrics.createdAt} desc
        )`.as('rn'),
      })
      .from(aiGenerationMetrics)
      .where(
        and(
          eq(aiGenerationMetrics.resourceType, resourceType),
          inArray(aiGenerationMetrics.resourceId, ids),
        ),
      )
      .as('ranked')

    const rows = await this.db.select().from(ranked).where(eq(ranked.rn, 1))

    for (const row of rows) {
      const mapped = mapRow(row)
      map.set(String(mapped.resourceId), mapped)
    }
    return map
  }

  async deleteByResource(
    resourceType: AiGenerationResourceType,
    resourceId: EntityId | string,
  ): Promise<number> {
    const result = await this.db
      .delete(aiGenerationMetrics)
      .where(
        and(
          eq(aiGenerationMetrics.resourceType, resourceType),
          eq(aiGenerationMetrics.resourceId, parseEntityId(resourceId)),
        ),
      )
      .returning({ id: aiGenerationMetrics.id })
    return result.length
  }

  async deleteByResources(
    resourceType: AiGenerationResourceType,
    resourceIds: Array<EntityId | string>,
  ): Promise<number> {
    if (!resourceIds.length) return 0
    const result = await this.db
      .delete(aiGenerationMetrics)
      .where(
        and(
          eq(aiGenerationMetrics.resourceType, resourceType),
          inArray(
            aiGenerationMetrics.resourceId,
            resourceIds.map((id) => parseEntityId(id)),
          ),
        ),
      )
      .returning({ id: aiGenerationMetrics.id })
    return result.length
  }

  async findLatest(
    resourceType: AiGenerationResourceType,
    resourceId: EntityId | string,
  ): Promise<AiGenerationMetricsRow | null> {
    const [row] = await this.db
      .select()
      .from(aiGenerationMetrics)
      .where(
        and(
          eq(aiGenerationMetrics.resourceType, resourceType),
          eq(aiGenerationMetrics.resourceId, parseEntityId(resourceId)),
        ),
      )
      .orderBy(desc(aiGenerationMetrics.createdAt))
      .limit(1)
    return row ? mapRow(row) : null
  }
}
