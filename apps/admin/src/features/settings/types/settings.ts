import type { ConfigFormGroup } from '~/api/options'
import type { TranslationKey } from '~/i18n/types'
import type { LucideIcon } from 'lucide-react'

export type AIProviderType =
  | 'anthropic'
  | 'openai'
  | 'openai-compatible'
  | 'openrouter'

export interface AIProviderConfig {
  apiKey: string
  defaultModel: string
  enabled: boolean
  endpoint?: string
  id: string
  name: string
  type: AIProviderType
}

export interface AIModelAssignment {
  model?: string
  providerId?: string
}

export interface AIConfig {
  aiEmbedding?: {
    backfillBatchSize?: number
    chunkMaxTokens?: number
    chunkOverlapTokens?: number
    defaultMinSimilarity?: number
    defaultTopK?: number
  }
  aiMemory?: {
    recallMinSimilarity?: number
    recallTopK?: number
  }
  aiPersona?: {
    distillSampleMaxTokens?: number
    exemplarsCandidateCacheTtlSec?: number
    exemplarsLengthMax?: number
    exemplarsLengthMin?: number
  }
  commentReviewModel?: AIModelAssignment
  echoDailyQuota?: number
  echoExemplarsCount?: number
  echoModel?: AIModelAssignment
  echoRetrievalMinSimilarity?: number
  echoRetrievalTopK?: number
  enableAutoGenerateInsightsOnCreate?: boolean
  enableAutoGenerateInsightsOnUpdate?: boolean
  enableAutoGenerateEchoOnCreate?: boolean
  enableAutoGenerateSummaryOnCreate?: boolean
  enableAutoGenerateSummaryOnUpdate?: boolean
  enableAutoGenerateTranslation?: boolean
  enableAutoTranslateInsights?: boolean
  enableEcho?: boolean
  enableInsights?: boolean
  enableSummary?: boolean
  enableTranslation?: boolean
  enableTranslationReview?: boolean
  embeddingModel?: AIModelAssignment
  insightsMinTextLength?: number
  insightsModel?: AIModelAssignment
  insightsTargetLanguages?: string[]
  insightsTranslationModel?: AIModelAssignment
  personaDistillModel?: AIModelAssignment
  providers?: AIProviderConfig[]
  summaryMinTextLength?: number
  summaryModel?: AIModelAssignment
  summaryTargetLanguages?: string[]
  translationModel?: AIModelAssignment
  translationReviewModel?: AIModelAssignment
  translationReviewScoreThreshold?: number
  translationTargetLanguages?: string[]
  writerModel?: AIModelAssignment
}

export interface AIProviderModel {
  id: string
  name: string
}

export type SettingsGroupType = 'account' | 'meta-preset' | 'system' | 'user'
export type OauthProviderType = 'github' | 'google'

export interface OauthOptions {
  providers?: Array<{
    enabled?: boolean
    type: OauthProviderType
  }>
  public?: Partial<
    Record<
      OauthProviderType,
      {
        clientId?: string
      }
    >
  >
}

export interface FlatOauthProvider {
  clientId: string
  enabled: boolean
  type: OauthProviderType
}

export interface SettingsGroupSummary {
  description?: string
  descriptionKey?: TranslationKey
  icon: LucideIcon
  key: string
  systemGroup?: ConfigFormGroup
  title?: string
  titleKey?: TranslationKey
  type: SettingsGroupType
}

export interface AccountSession {
  current?: boolean
  ip?: string
  lastActiveAt: string
  token: string
  ua?: string
}
