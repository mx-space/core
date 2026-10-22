export interface PipelineReviewerMetrics {
  invoked: boolean
  durationMs: number
  skippedReason: string | null
  rounds: number
  issuesCount: number
  issuesBySeverity: { minor: number; major: number }
  issueIds: string[]
  issues: Array<{
    id: string
    severity: 'minor' | 'major'
    problem: string
    hint?: string
  }>
}

export interface PipelineEditorMetrics {
  invoked: boolean
  durationMs: number
  skippedReason: string | null
  patchKeysRequested: string[]
  patchKeysApplied: string[]
  patchKeysDropped: string[]
  patches: Array<{ id: string; before: string; after: string }>
}

export interface PipelineMetrics {
  writerMs?: number
  reviewer?: PipelineReviewerMetrics
  editor?: PipelineEditorMetrics
}

export interface TranslationResult {
  sourceLang: string
  title: string
  text: string
  subtitle: string | null
  summary: string | null
  tags: string[] | null
  aiModel: string
  aiProvider: string
  contentFormat?: string
  content?: string
}
