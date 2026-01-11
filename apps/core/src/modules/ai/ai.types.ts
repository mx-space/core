export enum AIProviderType {
  OpenAI = 'openai',
  OpenAICompatible = 'openai-compatible',
  Anthropic = 'anthropic',
  OpenRouter = 'openrouter',
}

export enum AIFeatureKey {
  Summary = 'summary',
  Writer = 'writer',
  CommentReview = 'commentReview',
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
  /** Default model name */
  defaultModel: string
  /** Whether this provider is enabled */
  enabled: boolean
}

export interface AIModelAssignment {
  /** Provider ID to use */
  providerId: string
  /** Model name override (uses provider's default if not set) */
  model?: string
}
