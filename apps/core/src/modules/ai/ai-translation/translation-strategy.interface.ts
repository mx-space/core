import type { IModelRuntime } from '@mx-space/ai/runtime'
import type {
  PipelineMetrics,
  TranslationResult,
} from '@mx-space/ai/translation'

import type { AiStreamEvent } from '../ai-inflight/ai-inflight.types'
import type { ArticleContent } from './ai-translation.types'
import type { AITranslationModel } from './ai-translation.types-model'

export type {
  PipelineEditorMetrics,
  PipelineMetrics,
  PipelineReviewerMetrics,
  TranslationResult,
} from '@mx-space/ai/translation'

export const LEXICAL_TRANSLATION_STRATEGY = Symbol(
  'LEXICAL_TRANSLATION_STRATEGY',
)
export const MARKDOWN_TRANSLATION_STRATEGY = Symbol(
  'MARKDOWN_TRANSLATION_STRATEGY',
)

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
