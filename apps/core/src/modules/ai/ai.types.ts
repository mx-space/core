export enum AIProviderType {
  OpenAICompatible = 'openai-compatible',
  Anthropic = 'anthropic',
  Generic = 'generic',
}

export enum AIFeatureKey {
  Summary = 'summary',
  Writer = 'writer',
  CommentReview = 'commentReview',
  Translation = 'translation',
  TranslationReview = 'translationReview',
  Insights = 'insights',
  InsightsTranslation = 'insightsTranslation',
}

export interface AIProviderConfig {
  /** Unique identifier for this provider */
  id: string
  /** Display name */
  name: string
  /** Provider type */
  type: AIProviderType
  /** API key */
  apiKey: string
  /** Custom endpoint (required for OpenAI-compatible) */
  endpoint?: string
  /** Full URL to fetch the model list from; falls back to the pi registry when empty */
  modelListUrl?: string
  /** Append /v1 to the base URL when missing; defaults to true */
  appendV1?: boolean
  /** Default model name */
  defaultModel: string
  /** Whether this provider is enabled */
  enabled: boolean
  /** Optional context window size; falls back to pi registry / adapter default when null */
  contextWindow?: number | null
  /** Optional max output tokens; falls back to pi registry / adapter default when null */
  maxTokens?: number | null
}

export interface AIModelAssignment {
  /** Provider ID to use */
  providerId: string
  /** Model name override (uses provider's default if not set) */
  model?: string
}
