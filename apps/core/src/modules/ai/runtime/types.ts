import type { z } from 'zod'
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
}

export interface GenerateTextStreamOptions extends GenerateTextOptions {}

export interface TextStreamChunk {
  text: string
}

export interface GenerateTextResult {
  text: string
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}

export interface GenerateStructuredOptions<T extends z.ZodType> extends Omit<
  GenerateTextOptions,
  'prompt'
> {
  prompt: string
  systemPrompt?: string
  schema: T
}

export interface GenerateStructuredResult<T> {
  output: T
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}

export interface ModelInfo {
  id: string
  name: string
  created?: number
}

export interface RuntimeConfig {
  apiKey: string
  endpoint?: string
  model: string
  providerType: AIProviderType
  providerId: string
}
