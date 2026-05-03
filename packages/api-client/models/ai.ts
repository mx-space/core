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

export type AIInsightsStreamEvent =
  | { type: 'token'; data: string }
  | { type: 'done'; data: undefined }
  | { type: 'error'; data: string }
