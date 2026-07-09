import type { LucideIcon } from 'lucide-react'

import type { ConfigFormGroup } from '~/api/options'
import type { TranslationKey } from '~/i18n/types'

export type AIProviderType = 'anthropic' | 'generic' | 'openai-compatible'

export interface AIProviderConfig {
  apiKey: string
  appendV1?: boolean
  contextWindow?: number | null
  defaultModel: string
  enabled: boolean
  endpoint?: string
  id: string
  maxTokens?: number | null
  modelListUrl?: string
  name: string
  type: AIProviderType
}

export interface AIModelAssignment {
  model?: string
  providerId?: string
}

export interface AIConfig {
  commentReviewModel?: AIModelAssignment
  enableAutoGenerateInsightsOnCreate?: boolean
  enableAutoGenerateInsightsOnUpdate?: boolean
  enableAutoGenerateSummaryOnCreate?: boolean
  enableAutoGenerateSummaryOnUpdate?: boolean
  enableAutoGenerateTranslation?: boolean
  enableAutoTranslateInsights?: boolean
  enableInsights?: boolean
  enableSummary?: boolean
  enableTranslation?: boolean
  enableTranslationReview?: boolean
  insightsMinTextLength?: number
  insightsModel?: AIModelAssignment
  insightsTargetLanguages?: string[]
  insightsTranslationModel?: AIModelAssignment
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

export interface SeoI18nOverlay {
  description?: string
  keywords?: string[]
  title?: string
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
