import type { AIProviderType } from '../ai.types'

export interface TtsGenerateOptions {
  input: string
  language?: string
  providerParams?: Record<string, unknown>
  signal?: AbortSignal
  speed: number
  voice: string
}

export interface ITtsRuntime {
  generateSpeech: (
    opts: TtsGenerateOptions,
  ) => Promise<{ buffer: Buffer; mimeType: string }>
}

export interface TtsRuntimeAdapterConfig {
  apiKey: string
  endpoint?: string
  maxAttempts?: number
  model: string
  projectId?: string
  provider: string
  providerType?: AIProviderType
  retryDelayMs?: number
  sessionId?: string
}
