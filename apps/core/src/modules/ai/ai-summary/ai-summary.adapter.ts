import { Injectable, Logger } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import removeMdCodeblock from 'remove-md-codeblock'

import { AppErrorCode, createAppException } from '~/common/errors'
import { BusinessEvents } from '~/constants/business-event.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { DatabaseService } from '~/processors/database/database.service'

import { ConfigsService } from '../../configs/configs.service'
import { AI_PROMPTS } from '../ai.prompts'
import { AiService } from '../ai.service'
import { isGlobalArticleVisible } from '../ai-article-visibility.util'
import type { GenerationUsage } from '../ai-generation-metrics/ai-generation-metrics.types'
import {
  emptyUsage,
  mergeUsage,
} from '../ai-generation-metrics/ai-generation-metrics.types'
import { resolveArticleSourceLang } from '../ai-language.util'
import type {
  MultilangAdapter,
  MultilangDocView,
  MultilangGenerated,
  MultilangResolvedArticle,
  PushStreamEvent,
} from '../ai-multilang/ai-multilang.types'
import {
  piUsageToGenerationUsage,
  runtimeUsageToGenerationUsage,
} from '../runtime/pi-runtime.adapter'
import { AiSummaryRepository } from './ai-summary.repository'
import type { AiSummaryRow } from './ai-summary.types'
import { AISummaryModel } from './ai-summary.types'

export interface ArticleForSummary {
  title: string
  text: string
}

@Injectable()
export class AiSummaryAdapter implements MultilangAdapter<
  ArticleForSummary,
  AISummaryModel
> {
  readonly feature = 'summary' as const

  private readonly logger = new Logger(AiSummaryAdapter.name)

  constructor(
    private readonly aiSummaryRepository: AiSummaryRepository,
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigsService,
    private readonly aiService: AiService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  toSummaryDoc(row: AiSummaryRow | null): AISummaryModel | null {
    if (!row) return null
    return {
      ...row,
      createdAt: row.createdAt,
    } as unknown as AISummaryModel
  }

  async assertEnabled(): Promise<void> {
    const {
      ai: { enableSummary },
    } = await this.configService.waitForConfigReady()
    if (!enableSummary) {
      throw createAppException(AppErrorCode.AI_NOT_ENABLED)
    }
  }

  async resolveArticleDetailed(articleId: string): Promise<{
    article: ArticleForSummary
    sourceLang: string
    type: CollectionRefTypes.Post | CollectionRefTypes.Note
  }> {
    const article = await this.databaseService.findGlobalById(articleId)
    if (!article || !article.document) {
      throw createAppException(AppErrorCode.CONTENT_NOT_FOUND_CANT_PROCESS)
    }
    if (
      article.type === CollectionRefTypes.Recently ||
      article.type === CollectionRefTypes.Page
    ) {
      throw createAppException(AppErrorCode.CONTENT_NOT_FOUND_CANT_PROCESS)
    }
    // Never expose summaries for draft / password-protected / future-dated
    // content. Public endpoints and background tasks both flow through here.
    if (!isGlobalArticleVisible(article)) {
      throw createAppException(AppErrorCode.CONTENT_NOT_FOUND_CANT_PROCESS)
    }
    const doc = article.document as { title: string; text: string }
    return {
      article: { title: doc.title, text: doc.text },
      sourceLang: resolveArticleSourceLang(
        article.document as { meta?: Record<string, unknown> | null },
      ),
      type: article.type,
    }
  }

  async resolveArticle(
    refId: string,
  ): Promise<MultilangResolvedArticle<ArticleForSummary>> {
    const { article, sourceLang } = await this.resolveArticleDetailed(refId)
    return { article, text: article.text, sourceLang }
  }

  async generate(
    article: ArticleForSummary,
    lang: string,
    push?: PushStreamEvent,
    onToken?: (count?: number) => Promise<void>,
    onCost?: (usd: number) => Promise<void>,
  ): Promise<MultilangGenerated> {
    const text = removeMdCodeblock(article.text)
    const runtime = await this.aiService.getSummaryModel()
    const { systemPrompt, prompt, reasoningEffort } = AI_PROMPTS.summaryStream(
      lang,
      text,
    )
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: prompt },
    ]

    let fullText = ''
    let usage: GenerationUsage = emptyUsage()
    if (runtime.streamMessage) {
      const events = runtime.streamMessage({
        messages,
        temperature: 0.5,
        maxRetries: 2,
        reasoningEffort,
      })
      for await (const event of events) {
        if (event.type === 'text_delta') {
          const delta = event.delta
          if (typeof delta !== 'string' || delta.length === 0) continue
          fullText += delta
          if (push) await push({ type: 'token', data: delta })
        } else if (
          event.type === 'thinking_delta' ||
          event.type === 'toolcall_start' ||
          event.type === 'toolcall_delta' ||
          event.type === 'toolcall_end'
        ) {
          this.logger.debug(`stream non-text event filtered: ${event.type}`)
        } else if (event.type === 'done') {
          usage = mergeUsage(
            usage,
            piUsageToGenerationUsage(event.message.usage),
          )
        } else if (event.type === 'error') {
          throw new Error(event.error.errorMessage || 'AI summary stream error')
        }
      }
    } else {
      const result = await runtime.generateText({
        messages,
        temperature: 0.5,
        maxRetries: 2,
        reasoningEffort,
      })
      fullText = result.text
      usage = mergeUsage(usage, runtimeUsageToGenerationUsage(result.usage))
      if (push && result.text) await push({ type: 'token', data: result.text })
    }

    const parsed = JSON.parse(fullText) as { summary?: string }
    if (!parsed?.summary || typeof parsed.summary !== 'string') {
      throw new Error('Invalid summary JSON response')
    }

    const totalTokens = usage.totalTokens ?? 0
    const totalCost = usage.cost?.total ?? 0
    if (onToken) await onToken(totalTokens)
    if (onCost && totalCost > 0) await onCost(totalCost)

    return {
      content: parsed.summary,
      usage,
      providerId: runtime.providerInfo.id,
      model: runtime.providerInfo.model,
    }
  }

  async translate(
    sourceContent: string,
    targetLang: string,
    push?: PushStreamEvent,
  ): Promise<MultilangGenerated> {
    const runtime = await this.aiService.getSummaryModel()
    const { systemPrompt, prompt, reasoningEffort } =
      AI_PROMPTS.summaryTranslation(targetLang, sourceContent)
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: prompt },
    ]
    let raw = ''
    let usage: GenerationUsage = emptyUsage()
    if (runtime.generateTextStream) {
      for await (const chunk of runtime.generateTextStream({
        messages,
        temperature: 0.3,
        maxRetries: 2,
        reasoningEffort,
      })) {
        raw += chunk.text
        if (push) await push({ type: 'token', data: chunk.text })
      }
    } else {
      const out = await runtime.generateText({
        messages,
        temperature: 0.3,
        maxRetries: 2,
        reasoningEffort,
      })
      raw = out.text
      usage = mergeUsage(usage, runtimeUsageToGenerationUsage(out.usage))
      if (push && out.text) await push({ type: 'token', data: out.text })
    }
    const translated = raw.trim()
    if (!translated) {
      throw createAppException(AppErrorCode.AI_SERVICE_ERROR, {
        message: 'Summary translation returned empty content',
      })
    }
    return {
      content: translated,
      usage,
      providerId: runtime.providerInfo.id,
      model: runtime.providerInfo.model,
    }
  }

  async findById(id: string): Promise<AISummaryModel | null> {
    return this.toSummaryDoc(await this.aiSummaryRepository.findById(id))
  }

  async findBase(
    refId: string,
    sourceLang: string,
  ): Promise<AISummaryModel | null> {
    return this.toSummaryDoc(
      await this.aiSummaryRepository.findBaseForRef(refId, sourceLang),
    )
  }

  async findByRefAndLang(
    refId: string,
    lang: string,
  ): Promise<AISummaryModel | null> {
    return this.toSummaryDoc(
      await this.aiSummaryRepository.findByRefAndLang(refId, lang),
    )
  }

  async persistBase(input: {
    refId: string
    lang: string
    hash: string
    content: string
  }): Promise<AISummaryModel> {
    return this.toSummaryDoc(
      await this.aiSummaryRepository.upsert({
        refId: input.refId,
        lang: input.lang,
        hash: input.hash,
        summary: input.content,
        isTranslation: false,
        sourceSummaryId: null,
        sourceLang: input.lang,
      }),
    )!
  }

  async persistTranslation(input: {
    refId: string
    lang: string
    hash: string
    content: string
    sourceId: string
    sourceLang: string
  }): Promise<AISummaryModel> {
    return this.toSummaryDoc(
      await this.aiSummaryRepository.upsert({
        refId: input.refId,
        lang: input.lang,
        hash: input.hash,
        summary: input.content,
        isTranslation: true,
        sourceSummaryId: input.sourceId,
        sourceLang: input.sourceLang,
      }),
    )!
  }

  async deleteStaleTranslations(refId: string, hash: string) {
    return this.aiSummaryRepository.deleteTranslationsWithDifferentHash(
      refId,
      hash,
    )
  }

  emitGenerated(
    doc: AISummaryModel,
    event: { refId: string; sourceLang: string; sourceHash: string },
  ): void {
    this.eventEmitter.emit(BusinessEvents.SUMMARY_GENERATED, {
      refId: event.refId,
      sourceLang: event.sourceLang,
      summaryId: doc.id,
      sourceHash: event.sourceHash,
    })
  }

  readDoc(doc: AISummaryModel): MultilangDocView {
    return {
      id: doc.id!,
      lang: doc.lang || '',
      hash: doc.hash,
      content: doc.summary,
      isTranslation: !!doc.isTranslation,
      sourceLang: doc.sourceLang ?? null,
    }
  }
}
