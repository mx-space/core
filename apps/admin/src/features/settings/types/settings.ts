import type { LucideIcon } from 'lucide-react'

import type { ConfigFormGroup } from '~/api/options'
import type { TranslationKey } from '~/i18n/types'

export type AIProviderType =
  'anthropic' | 'generic' | 'google-vertex' | 'openai-compatible'
export type AIProviderCapability = 'image' | 'speech' | 'text'

export interface AIProviderCapabilities {
  image: boolean
  speech: boolean
  text: boolean
}

export interface AIProviderConfig {
  apiKey: string
  appendV1?: boolean
  capabilities?: AIProviderCapabilities
  contextWindow?: number | null
  defaultModel: string
  enabled: boolean
  endpoint?: string
  id: string
  maxTokens?: number | null
  modelListUrl?: string
  name: string
  projectId?: string
  type: AIProviderType
  voiceListUrl?: string
}

export type AIReasoningEffort = 'none' | 'low' | 'medium' | 'high'

export interface AIModelAssignment {
  model?: string
  providerId?: string
  reasoningEffort?: AIReasoningEffort
}

export interface AIConfig {
  version?: 2
  commentReviewModel?: AIModelAssignment | null
  enableAutoGenerateTranslation?: boolean
  enableAutoTranslateInsights?: boolean
  enableInsights?: boolean
  enableSummary?: boolean
  enableTranslation?: boolean
  enableTranslationReview?: boolean
  insightsModel?: AIModelAssignment | null
  insightsTargetLanguages?: string[]
  insightsTranslationModel?: AIModelAssignment | null
  imageGeneration?: {
    defaultAspectRatio?: string
    defaultFormat?: 'jpeg' | 'png' | 'webp'
    defaultQuality?: 'high' | 'low' | 'standard'
    enable?: boolean
    model?: AIModelAssignment | null
  }
  providers?: AIProviderConfig[]
  summaryModel?: AIModelAssignment | null
  summaryTargetLanguages?: string[]
  translationModel?: AIModelAssignment | null
  translationReviewModel?: AIModelAssignment | null
  translationTargetLanguages?: string[]
  tts?: {
    concurrency?: number
    enable?: boolean
    maxCharsPerChunk?: number
    maxCharsPerRun?: number
    model?: AIModelAssignment | null
    speed?: number
    voice?: string
  }
  writerModel?: AIModelAssignment | null
}

export interface AIProviderModel {
  id: string
  name: string
  pricing?: AIModelPricing
  supportedVoices?: string[]
}

export interface AIModelPricing {
  completion?: string
  image?: string
  prompt?: string
  request?: string
  unit: 'character' | 'token'
}

export interface SeoI18nOverlay {
  description?: string
  keywords?: string[]
  title?: string
}

export type SettingsGroupType =
  'account' | 'maintenance' | 'meta-preset' | 'system' | 'user'
export type OauthProviderType = 'apple' | 'github' | 'google'

export interface OauthOptions {
  providers?: Array<{
    enabled?: boolean
    type: OauthProviderType
  }>
  public?: Partial<Record<OauthProviderType, Record<string, string>>>
}

export interface OauthProviderField {
  descriptionKey?: TranslationKey
  key: string
  label: string
  multiline?: boolean
  optional?: boolean
  placeholder?: string
  placeholderKey?: TranslationKey
  secret?: boolean
}

export interface FlatOauthProvider {
  configured: boolean
  enabled: boolean
  public: Record<string, string>
  type: OauthProviderType
}

export interface OauthProviderPayload {
  enabled: boolean
  public: Record<string, string>
  secrets: Record<string, string>
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
