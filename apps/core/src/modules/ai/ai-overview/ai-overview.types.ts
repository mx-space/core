import type { RefArticleInfo } from '~/processors/database/database.service'

import type { GenerationMetricsDto } from '../ai-generation-metrics/ai-generation-metrics.types'

export const AI_OVERVIEW_CAPABILITIES = [
  'summary',
  'insights',
  'translation',
  'tts',
] as const

export type AiOverviewCapability = (typeof AI_OVERVIEW_CAPABILITIES)[number]

export interface CapabilityCoverage {
  langs: string[]
  expected: string[]
  applicable: boolean
}

export interface ArticleCoverage {
  sourceLang: string | null
  summary: CapabilityCoverage
  insights: CapabilityCoverage
  translation: CapabilityCoverage
  tts: CapabilityCoverage
}

export interface AiOverviewListRow {
  article: RefArticleInfo
  coverage: ArticleCoverage
  gapCount: number
}

export interface SummaryAsset {
  id: string
  lang: string
  summary: string
  isTranslation: boolean
  sourceLang: string | null
  createdAt: Date
  generationMetrics?: GenerationMetricsDto | null
}

export interface InsightsAsset {
  id: string
  lang: string
  content: string
  isTranslation: boolean
  sourceLang: string | null
  createdAt: Date
  generationMetrics?: GenerationMetricsDto | null
}

export interface TranslationAsset {
  id: string
  lang: string
  sourceLang: string
  aiModel: string | null
  createdAt: Date
  updatedAt: Date | null
  generationMetrics?: GenerationMetricsDto | null
}

export interface TtsAsset {
  id: string
  lang: string
  isTranslation: boolean
  charCount: number
  durationMs: number | null
  createdAt: Date
  updatedAt: Date | null
  generationMetrics?: GenerationMetricsDto | null
}

export interface CostBucket {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  totalTokens: number
  costTotalUsd: number
  generationCount: number
}

export interface AiOverviewCost {
  total: CostBucket
  byResourceType: Record<AiOverviewCapability, CostBucket>
  models: string[]
}

export interface ActiveGeneration {
  capability: AiOverviewCapability
  /** Empty means the task covers the whole capability, language unspecified. */
  langs: string[]
  taskId: string
  status: string
  /** 0-100 where the worker reports it; absent while still queued. */
  progress: number | null
  progressMessage: string | null
  completedItems: number | null
  totalItems: number | null
  startedAt: number | null
  /** Set once the task reached a failed state; null while it is still viable. */
  error: string | null
}

export interface AiOverviewDetail {
  article: RefArticleInfo
  coverage: ArticleCoverage
  activeTasks: ActiveGeneration[]
  assets: {
    summary: SummaryAsset[]
    insights: InsightsAsset[]
    translation: TranslationAsset[]
    tts: TtsAsset[]
  }
  cost: AiOverviewCost
}

export function emptyCostBucket(): CostBucket {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalTokens: 0,
    costTotalUsd: 0,
    generationCount: 0,
  }
}
