export interface AISummaryModel {
  id: string
  created: string
  summary: string
  hash: string
  refId: string
  lang: string
}

export interface AITranslationModel {
  id: string
  created: string
  hash: string
  refId: string
  refType: string
  lang: string
  sourceLang: string
  title: string
  text: string
  summary?: string
  tags?: string[]
  aiModel?: string
  aiProvider?: string
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
