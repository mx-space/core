export enum AIProviderType {
  OpenAICompatible = 'openai-compatible',
  Anthropic = 'anthropic',
  Generic = 'generic',
  GoogleVertex = 'google-vertex',
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

export type AIProviderCapability = 'image' | 'speech' | 'text'

export interface AIProviderCapabilities {
  text: boolean
  image: boolean
  speech: boolean
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
  /** Google Cloud project used by Vertex AI */
  projectId?: string
  /** Full URL to fetch the model list from; falls back to the pi registry when empty */
  modelListUrl?: string
  /** Full URL to fetch speech voices from; falls back to the built-in catalog when empty */
  voiceListUrl?: string
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
  /** Runtime capabilities that may reuse this connection and credential */
  capabilities?: AIProviderCapabilities
}

export type AIReasoningEffort = 'none' | 'low' | 'medium' | 'high'

export interface AIModelAssignment {
  /** Provider ID to use */
  providerId?: string
  /** Model name override (uses provider's default if not set) */
  model?: string
  /** Thinking / reasoning effort for models that support it */
  reasoningEffort?: AIReasoningEffort
}
