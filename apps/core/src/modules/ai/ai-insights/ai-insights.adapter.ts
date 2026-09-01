import { Injectable, Logger } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'

import { AppErrorCode, createAppException } from '~/common/errors'
import { BusinessEvents } from '~/constants/business-event.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { DatabaseService } from '~/processors/database/database.service'

import { ConfigsService } from '../../configs/configs.service'
import { EntitlementService } from '../../membership/entitlement.service'
import { AI_PROMPTS } from '../ai.prompts'
import { AiService } from '../ai.service'
import {
  type ArticleViewer,
  isArticleVisibleToViewer,
} from '../ai-article-visibility.util'
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
import { AiInsightsRepository } from './ai-insights.repository'
import type { AIInsightsModel, AiInsightsRow } from './ai-insights.types'
import { stripTopLevelCodeFence } from './insights.util'

export interface ArticleForInsights {
  title: string
  text: string
  subtitle?: string
  tags?: string[]
}

@Injectable()
export class AiInsightsAdapter implements MultilangAdapter<
  ArticleForInsights,
  AIInsightsModel
> {
  readonly feature = 'insights' as const

  private readonly logger = new Logger(AiInsightsAdapter.name)

  constructor(
    private readonly aiInsightsRepository: AiInsightsRepository,
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigsService,
    private readonly aiService: AiService,
    private readonly eventEmitter: EventEmitter2,
    private readonly entitlementService: EntitlementService,
  ) {}

  toInsightsDoc(row: AiInsightsRow | null): AIInsightsModel | null {
    if (!row) return null
    return {
      ...row,
      createdAt: row.createdAt,
    } as unknown as AIInsightsModel
  }

  async assertEnabled(): Promise<void> {
    const {
      ai: { enableInsights },
    } = await this.configService.waitForConfigReady()
    if (!enableInsights) {
      throw createAppException(AppErrorCode.AI_NOT_ENABLED)
    }
  }

  async resolveArticleDetailed(
    articleId: string,
    options?: {
      blockPremium?: boolean
      isOwner?: boolean
      readerId?: string
    },
  ): Promise<{
    article: ArticleForInsights
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
    if (!isArticleVisibleToViewer(article, options ?? {})) {
      throw createAppException(AppErrorCode.CONTENT_NOT_FOUND_CANT_PROCESS)
    }
    if (
      options?.blockPremium &&
      article.type === CollectionRefTypes.Post &&
      (await this.entitlementService.isPremiumLocked({
        isPremium: (article.document as { isPremium?: boolean | null })
          .isPremium,
        isOwner: Boolean(options.isOwner),
        readerId: options.readerId,
      }))
    ) {
      throw createAppException(AppErrorCode.POST_HIDDEN_OR_ENCRYPTED)
    }
    const doc = article.document as any
    return {
      article: {
        title: doc.title,
        text: doc.text,
        subtitle: doc.subtitle,
        tags: Array.isArray(doc.tags) ? doc.tags : undefined,
      },
      sourceLang: resolveArticleSourceLang(doc),
      type: article.type,
    }
  }

  async resolveArticle(
    refId: string,
    viewer?: ArticleViewer,
  ): Promise<MultilangResolvedArticle<ArticleForInsights>> {
    const { article, sourceLang } = await this.resolveArticleDetailed(
      refId,
      viewer,
    )
    return { article, text: article.text, sourceLang }
  }

  async generate(
    article: ArticleForInsights,
    lang: string,
    push?: PushStreamEvent,
    onToken?: (count?: number) => Promise<void>,
    onCost?: (usd: number) => Promise<void>,
  ): Promise<MultilangGenerated> {
    const runtime = await this.aiService.getInsightsModel()
    const { systemPrompt, prompt, reasoningEffort } = AI_PROMPTS.insightsStream(
      lang,
      article,
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
        temperature: 0.6,
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
          throw new Error(
            event.error.errorMessage || 'AI insights stream error',
          )
        }
      }
    } else {
      const result = await runtime.generateText({
        messages,
        temperature: 0.6,
        maxRetries: 2,
        reasoningEffort,
      })
      fullText = result.text
      usage = mergeUsage(usage, runtimeUsageToGenerationUsage(result.usage))
      if (push && result.text) await push({ type: 'token', data: result.text })
    }
    const totalTokens = usage.totalTokens ?? 0
    const totalCost = usage.cost?.total ?? 0
    if (onToken) await onToken(totalTokens)
    if (onCost && totalCost > 0) await onCost(totalCost)
    const stripped = stripTopLevelCodeFence(fullText)
    return {
      content: stripped.trim(),
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
    const runtime = await this.aiService.getInsightsTranslationModel()
    const { systemPrompt, prompt, reasoningEffort } =
      AI_PROMPTS.insightsTranslation(targetLang, sourceContent)
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
    const translatedText = stripTopLevelCodeFence(raw).trim()
    if (!translatedText) {
      throw createAppException(AppErrorCode.AI_SERVICE_ERROR, {
        message: 'Insights translation returned empty content',
      })
    }
    return {
      content: translatedText,
      usage,
      providerId: runtime.providerInfo.id,
      model: runtime.providerInfo.model,
    }
  }

  async findById(id: string): Promise<AIInsightsModel | null> {
    return this.toInsightsDoc(await this.aiInsightsRepository.findById(id))
  }

  async findBase(
    refId: string,
    sourceLang: string,
  ): Promise<AIInsightsModel | null> {
    return this.toInsightsDoc(
      await this.aiInsightsRepository.findSourceForRef(refId, sourceLang),
    )
  }

  async findByRefAndLang(
    refId: string,
    lang: string,
  ): Promise<AIInsightsModel | null> {
    return this.toInsightsDoc(
      await this.aiInsightsRepository.findByRefAndLang(refId, lang),
    )
  }

  async persistBase(input: {
    refId: string
    lang: string
    hash: string
    content: string
  }): Promise<AIInsightsModel> {
    return this.toInsightsDoc(
      await this.aiInsightsRepository.upsert({
        refId: input.refId,
        lang: input.lang,
        hash: input.hash,
        content: input.content,
        isTranslation: false,
        sourceInsightsId: null,
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
  }): Promise<AIInsightsModel> {
    return this.toInsightsDoc(
      await this.aiInsightsRepository.upsert({
        refId: input.refId,
        lang: input.lang,
        hash: input.hash,
        content: input.content,
        isTranslation: true,
        sourceInsightsId: input.sourceId,
        sourceLang: input.sourceLang,
      }),
    )!
  }

  emitGenerated(
    doc: AIInsightsModel,
    event: { refId: string; sourceLang: string; sourceHash: string },
  ): void {
    this.eventEmitter.emit(BusinessEvents.INSIGHTS_GENERATED, {
      refId: event.refId,
      sourceLang: event.sourceLang,
      insightsId: doc.id,
      sourceHash: event.sourceHash,
    })
  }

  readDoc(doc: AIInsightsModel): MultilangDocView {
    return {
      id: doc.id!,
      lang: doc.lang,
      hash: doc.hash,
      content: doc.content,
      isTranslation: !!doc.isTranslation,
      sourceLang: doc.sourceLang ?? null,
    }
  }
}
