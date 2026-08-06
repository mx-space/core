import type { AiStreamEvent } from '../ai-inflight/ai-inflight.types'
import type { IModelRuntime } from '../runtime'
import type { ArticleContent } from './ai-translation.types'
import type { AITranslationModel } from './ai-translation.types-model'

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

export const LEXICAL_TRANSLATION_STRATEGY = Symbol(
  'LEXICAL_TRANSLATION_STRATEGY',
)
export const MARKDOWN_TRANSLATION_STRATEGY = Symbol(
  'MARKDOWN_TRANSLATION_STRATEGY',
)

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

export interface TranslationStrategyOptions {
  push?: (event: AiStreamEvent) => Promise<void>
  onToken?: (count?: number) => Promise<void>
  onCost?: (usd: number) => Promise<void>
  signal?: AbortSignal
  existing?: AITranslationModel | null
  reviewerRuntime?: IModelRuntime
  metrics?: PipelineMetrics
  styleHints?: string
}

export interface ITranslationStrategy {
  translate: (
    content: ArticleContent,
    targetLang: string,
    runtime: IModelRuntime,
    info: { model: string; provider: string },
    options: TranslationStrategyOptions,
  ) => Promise<TranslationResult>
}
