import type { Message as PiMessage, Tool, TSchema } from '@earendil-works/pi-ai'

import type { AIProviderType } from '../ai.types'

export interface RuntimeProviderInfo {
  id: string
  type: AIProviderType
  model: string
}

export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high'

export interface GenerateTextOptions {
  prompt?: string
  messages?: Message[]
  temperature?: number
  maxTokens?: number
  maxRetries?: number
  reasoningEffort?: ReasoningEffort
  signal?: AbortSignal
}

export interface GenerateTextStreamOptions extends GenerateTextOptions {}

export interface TextStreamChunk {
  text: string
}

export interface RuntimeUsage {
  promptTokens?: number
  completionTokens?: number
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  totalTokens?: number
  /** @deprecated prefer costBreakdown.total — kept for existing call sites */
  cost?: number
  costBreakdown?: {
    input?: number
    output?: number
    cacheRead?: number
    cacheWrite?: number
    total?: number
  }
}

export interface GenerateTextResult {
  text: string
  usage?: RuntimeUsage
}

export interface GenerateStructuredOptions<T extends TSchema> extends Omit<
  GenerateTextOptions,
  'prompt'
> {
  prompt: string
  systemPrompt?: string
  schema: T
  /**
   * When true (default) the adapter validates the model's tool call output
   * against the TypeBox schema before returning. Pass false to skip validation
   * when the caller post-processes the raw output before validating itself
   * (e.g. base-translation-strategy normalises chunks before schema.parse).
   */
  validate?: boolean
}

export interface GenerateStructuredResult<T> {
  output: T
  usage?: RuntimeUsage
}

export interface StructuredStreamChunk<T> {
  partial: Partial<T>
  delta?: string
  done?: boolean
  final?: T
  usage?: RuntimeUsage
}

export interface StreamMessageOptions extends Omit<
  GenerateTextOptions,
  'prompt' | 'messages'
> {
  /**
   * Accepts either the thin runtime `Message` shape (text-only sys/user/asst)
   * or full pi `Message[]` (UserMessage / AssistantMessage / ToolResultMessage)
   * for multi-turn tool-call conversations. The adapter detects per-element.
   */
  messages: (Message | PiMessage)[]
  systemPrompt?: string
  tools?: Tool[]
}

export interface ModelInfo {
  id: string
  name: string
  created?: number
  pricing?: {
    completion?: string
    image?: string
    prompt?: string
    request?: string
    unit: 'character' | 'token'
  }
  supportedVoices?: string[]
}

export interface RuntimeConfig {
  apiKey: string
  endpoint?: string
  modelListUrl?: string
  appendV1?: boolean
  model: string
  providerType: AIProviderType
  providerId: string
}
