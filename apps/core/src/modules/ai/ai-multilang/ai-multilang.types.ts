import type { GenerationUsage } from '../ai-generation-metrics/ai-generation-metrics.types'
import type { AiStreamEvent } from '../ai-inflight/ai-inflight.types'

export type MultilangFeature = 'summary' | 'insights'

export interface MultilangGenerated {
  content: string
  usage: GenerationUsage
  providerId: string
  model: string
}

export interface MultilangDocView {
  id: string
  lang: string
  hash: string
  content: string
  isTranslation: boolean
  sourceLang: string | null
}

export type PushStreamEvent = (event: AiStreamEvent) => Promise<void>

export interface MultilangResolvedArticle<TArticle> {
  article: TArticle
  text: string
  sourceLang: string
}

export interface MultilangAdapter<TArticle, TDoc> {
  readonly feature: MultilangFeature
  assertEnabled: () => Promise<void>
  resolveArticle: (refId: string) => Promise<MultilangResolvedArticle<TArticle>>
  generate: (
    article: TArticle,
    lang: string,
    push?: PushStreamEvent,
    onToken?: (count?: number) => Promise<void>,
    onCost?: (usd: number) => Promise<void>,
  ) => Promise<MultilangGenerated>
  translate: (
    sourceContent: string,
    targetLang: string,
    push?: PushStreamEvent,
  ) => Promise<MultilangGenerated>
  findById: (id: string) => Promise<TDoc | null>
  findBase: (refId: string, sourceLang: string) => Promise<TDoc | null>
  findByRefAndLang: (refId: string, lang: string) => Promise<TDoc | null>
  persistBase: (input: {
    refId: string
    lang: string
    hash: string
    content: string
  }) => Promise<TDoc>
  persistTranslation: (input: {
    refId: string
    lang: string
    hash: string
    content: string
    sourceId: string
    sourceLang: string
  }) => Promise<TDoc>
  deleteStaleTranslations: (refId: string, hash: string) => Promise<unknown>
  emitGenerated: (
    doc: TDoc,
    event: { refId: string; sourceLang: string; sourceHash: string },
  ) => void
  readDoc: (doc: TDoc) => MultilangDocView
}

export interface MultilangTaskResult<TDoc> {
  base: TDoc
  sourceLang: string
  translated: Array<{ doc: TDoc; lang: string }>
  failedLangs: string[]
}
