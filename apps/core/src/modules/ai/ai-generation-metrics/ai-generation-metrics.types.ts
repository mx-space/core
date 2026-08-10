import type { EntityId } from '~/shared/id/entity-id'

export const AI_GENERATION_RESOURCE_TYPES = [
  'summary',
  'insights',
  'translation',
  'tts',
] as const

export type AiGenerationResourceType =
  (typeof AI_GENERATION_RESOURCE_TYPES)[number]

export interface GenerationUsage {
  inputTokens?: number | null
  outputTokens?: number | null
  cacheReadTokens?: number | null
  cacheWriteTokens?: number | null
  totalTokens?: number | null
  cost?: {
    input?: number | null
    output?: number | null
    cacheRead?: number | null
    cacheWrite?: number | null
    total?: number | null
  } | null
}

export interface RecordGenerationMetricsInput {
  resourceType: AiGenerationResourceType
  resourceId: EntityId | string
  refId: EntityId | string
  lang?: string | null
  taskId?: string | null
  providerId?: string | null
  model?: string | null
  usage?: GenerationUsage | null
}

export interface GenerationMetricsDto {
  inputTokens: number | null
  outputTokens: number | null
  cacheReadTokens: number | null
  cacheWriteTokens: number | null
  totalTokens: number | null
  costInputUsd: number | null
  costOutputUsd: number | null
  costCacheReadUsd: number | null
  costCacheWriteUsd: number | null
  costTotalUsd: number | null
  providerId: string | null
  model: string | null
  createdAt: string
}

export interface GenerationSumRow {
  resourceType: AiGenerationResourceType
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  totalTokens: number
  costTotalUsd: number
  generationCount: number
}

export interface AiGenerationMetricsRow {
  id: EntityId
  createdAt: Date
  resourceType: AiGenerationResourceType
  resourceId: EntityId
  refId: EntityId
  lang: string | null
  taskId: string | null
  providerId: string | null
  model: string | null
  inputTokens: number | null
  outputTokens: number | null
  cacheReadTokens: number | null
  cacheWriteTokens: number | null
  totalTokens: number | null
  costInputUsd: number | null
  costOutputUsd: number | null
  costCacheReadUsd: number | null
  costCacheWriteUsd: number | null
  costTotalUsd: number | null
}

export function resolveCostTotalUsd(
  usage?: GenerationUsage | null,
): number | null {
  if (!usage?.cost) return null
  const total = usage.cost.total
  if (typeof total === 'number' && Number.isFinite(total) && total > 0) {
    return total
  }
  const parts = [
    usage.cost.input,
    usage.cost.output,
    usage.cost.cacheRead,
    usage.cost.cacheWrite,
  ].filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (!parts.length) return null
  const sum = parts.reduce((a, b) => a + b, 0)
  return sum > 0 ? sum : null
}

export function resolveTotalTokens(
  usage?: GenerationUsage | null,
): number | null {
  if (!usage) return null
  if (
    typeof usage.totalTokens === 'number' &&
    Number.isFinite(usage.totalTokens)
  ) {
    return usage.totalTokens
  }
  const parts = [
    usage.inputTokens,
    usage.outputTokens,
    usage.cacheReadTokens,
    usage.cacheWriteTokens,
  ].filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (!parts.length) return null
  return parts.reduce((a, b) => a + b, 0)
}

export function toGenerationMetricsDto(
  row: AiGenerationMetricsRow,
): GenerationMetricsDto {
  return {
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
    providerId: row.providerId,
    model: row.model,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  }
}

export function mergeUsage(
  acc: GenerationUsage,
  next?: GenerationUsage | null,
): GenerationUsage {
  if (!next) return acc
  const add = (a?: number | null, b?: number | null) => {
    const av = typeof a === 'number' && Number.isFinite(a) ? a : 0
    const bv = typeof b === 'number' && Number.isFinite(b) ? b : 0
    if (a == null && b == null) return a ?? b ?? null
    return av + bv
  }
  return {
    inputTokens: add(acc.inputTokens, next.inputTokens),
    outputTokens: add(acc.outputTokens, next.outputTokens),
    cacheReadTokens: add(acc.cacheReadTokens, next.cacheReadTokens),
    cacheWriteTokens: add(acc.cacheWriteTokens, next.cacheWriteTokens),
    totalTokens: add(acc.totalTokens, next.totalTokens),
    cost: {
      input: add(acc.cost?.input, next.cost?.input),
      output: add(acc.cost?.output, next.cost?.output),
      cacheRead: add(acc.cost?.cacheRead, next.cost?.cacheRead),
      cacheWrite: add(acc.cost?.cacheWrite, next.cost?.cacheWrite),
      total: add(acc.cost?.total, next.cost?.total),
    },
  }
}

export function emptyUsage(): GenerationUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  }
}
