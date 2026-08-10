import type { ArticleInfo, GenerationMetrics, PaginationInfo } from './ai'
import { getJson } from './http'

export const AI_OVERVIEW_CAPABILITIES = [
  'summary',
  'insights',
  'translation',
  'tts',
] as const

export type AiOverviewCapability = (typeof AI_OVERVIEW_CAPABILITIES)[number]

export interface CapabilityCoverage {
  applicable: boolean
  expected: string[]
  langs: string[]
}

export type ArticleCoverage = Record<
  AiOverviewCapability,
  CapabilityCoverage
> & {
  sourceLang: string | null
}

export interface AiOverviewListRow {
  article: ArticleInfo
  coverage: ArticleCoverage
  gapCount: number
}

export interface AiOverviewListResponse {
  data: AiOverviewListRow[]
  pagination: PaginationInfo
}

interface AssetBase {
  createdAt: string
  generationMetrics?: GenerationMetrics | null
  id: string
  lang: string
}

export interface SummaryAsset extends AssetBase {
  summary: string
}

export interface InsightsAsset extends AssetBase {
  content: string
  isTranslation: boolean
  sourceLang: string | null
}

export interface TranslationAsset extends AssetBase {
  aiModel: string | null
  sourceLang: string
  updatedAt: string | null
}

export interface TtsAsset extends AssetBase {
  charCount: number
  durationMs: number | null
  isTranslation: boolean
  updatedAt: string | null
}

export interface CostBucket {
  cacheReadTokens: number
  cacheWriteTokens: number
  costTotalUsd: number
  generationCount: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export interface ActiveGeneration {
  capability: AiOverviewCapability
  langs: string[]
  status: string
  taskId: string
}

export interface AiOverviewDetail {
  activeTasks: ActiveGeneration[]
  article: ArticleInfo
  assets: {
    insights: InsightsAsset[]
    summary: SummaryAsset[]
    translation: TranslationAsset[]
    tts: TtsAsset[]
  }
  cost: {
    byResourceType: Record<AiOverviewCapability, CostBucket>
    models: string[]
    total: CostBucket
  }
  coverage: ArticleCoverage
}

export const OVERVIEW_ARTICLE_TYPES = ['post', 'note', 'page'] as const

export type OverviewArticleType = (typeof OVERVIEW_ARTICLE_TYPES)[number]

export function getOverviewGrouped(params?: {
  page?: number
  search?: string
  size?: number
  type?: OverviewArticleType
}) {
  return getJson<AiOverviewListResponse>('/ai/overview/grouped', params)
}

export function getArticleOverview(refId: string) {
  return getJson<AiOverviewDetail>(`/ai/overview/article/${refId}`)
}
