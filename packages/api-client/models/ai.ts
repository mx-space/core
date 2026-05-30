export type AIProviderType = 'anthropic' | 'generic' | 'openai-compatible'

export interface AIProviderConfigModel {
  apiKey: string
  contextWindow?: number | null
  defaultModel: string
  enabled: boolean
  endpoint?: string
  id: string
  maxTokens?: number | null
  name: string
  type: AIProviderType
}

export interface AISummaryModel {
  id: string
  createdAt: string
  summary: string
  hash: string
  refId: string
  lang: string | null
}

export interface AITranslationModel {
  id: string
  createdAt: string
  hash: string
  refId: string
  refType: string
  lang: string
  sourceLang: string
  title: string
  text: string
  subtitle: string | null
  summary: string | null
  tags: string[]
  aiModel: string | null
  aiProvider: string | null
  contentFormat: string | null
  content: string | null
}

export interface AIDeepReadingModel {
  id: string
  hash: string
  refId: string
  keyPoints: string[]
  criticalAnalysis: string
  content: string
}

/**
 * SSE Stream Event Types
 *
 * Note: All data fields are transmitted as strings over SSE.
 * Objects are JSON.stringify'd before sending.
 *
 * `error.data` wire format: a JSON-encoded string of the shape
 * `{"message": string}`. Server-side this originates from
 * `JSON.stringify({ message })` on the inflight error path. Consumers
 * MUST `JSON.parse(event.data)` and then read `.message`. The shape
 * stays a plain `string` in TypeScript so the SSE event union is
 * uniform across token/done/error frames (token frames carry a raw
 * string token); pinning it to an object would force every transport
 * to invert the JSON before reaching the union. Do not change without
 * a coordinated api-client major bump — Shiro/Yohaku public consumers
 * parse this manually today.
 */

export type AISummaryStreamEvent =
  | { type: 'token'; data: string }
  | { type: 'done'; data: undefined }
  | { type: 'error'; data: string }

export type AITranslationStreamEvent =
  | { type: 'token'; data: string }
  | { type: 'done'; data: undefined }
  | { type: 'error'; data: string }

export interface AIInsightsModel {
  id: string
  createdAt: string
  hash: string
  refId: string
  lang: string
  content: string
  isTranslation: boolean
  sourceInsightsId: string | null
  sourceLang: string | null
  modelInfo: Record<string, unknown> | null
}

/**
 * `error.data` follows the same `JSON.stringify({message: string})`
 * convention as AISummaryStreamEvent above. See that block for the
 * rationale.
 */
export type AIInsightsStreamEvent =
  | { type: 'token'; data: string }
  | { type: 'done'; data: undefined }
  | { type: 'error'; data: string }
