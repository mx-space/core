export interface AISummaryModel {
  id: string
  created: string
  summary: string
  hash: string
  refId: string
  lang: string
}

export interface AIDeepReadingModel {
  id: string
  hash: string
  refId: string
  keyPoints: string[]
  criticalAnalysis: string
  content: string
}
