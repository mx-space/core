import type { IModelRuntime } from '../runtime'
import type { ArticleContent } from './article-content.types'
import type { PipelineMetrics, TranslationResult } from './pipeline.types'

export type TranslationStreamEvent =
  | { type: 'token'; data: string }
  | { type: 'done'; data: { resultId: string } }
  | { type: 'error'; data: { message: string } }
  | {
      type: 'partial'
      data: {
        lang?: string
        segmentId?: string
        partial: unknown
        done?: boolean
      }
    }

export interface ExistingTranslation {
  sourceLang: string
  title: string
  text: string
  subtitle: string | null
  summary: string | null
  tags: string[]
  contentFormat: string | null
  content: string | null
  sourceBlockSnapshots: unknown
  sourceMetaHashes: unknown
}

export interface LexicalRootBlockSnapshot {
  id: string | null
  type: string
  text: string
  fingerprint: string
  index: number
}

export interface LexicalDocumentAdapter {
  extractRootBlocks: (content: string) => LexicalRootBlockSnapshot[]
  lexicalToMarkdown: (editorState: string) => string
}

export interface TranslationStrategyOptions {
  push?: (event: TranslationStreamEvent) => Promise<void>
  onToken?: (count?: number) => Promise<void>
  onCost?: (usd: number) => Promise<void>
  signal?: AbortSignal
  existing?: ExistingTranslation | null
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

export const LEXICAL_CONTENT_FORMAT = 'lexical'
