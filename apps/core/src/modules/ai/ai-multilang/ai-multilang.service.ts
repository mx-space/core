import { Injectable } from '@nestjs/common'
import pLimit from 'p-limit'
import removeMdCodeblock from 'remove-md-codeblock'

import { AppErrorCode, createAppException } from '~/common/errors'
import { type TaskExecuteContext, TaskStatus } from '~/processors/task-queue'
import { createAbortError } from '~/utils/abort.util'
import { md5 } from '~/utils/tool.util'

import { ConfigsService } from '../../configs/configs.service'
import {
  AI_STREAM_IDLE_TIMEOUT_MS,
  AI_STREAM_LOCK_TTL,
  AI_STREAM_MAXLEN,
  AI_STREAM_READ_BLOCK_MS,
  AI_STREAM_RESULT_TTL,
} from '../ai.constants'
import { AiGenerationMetricsService } from '../ai-generation-metrics/ai-generation-metrics.service'
import { AiInFlightService } from '../ai-inflight/ai-inflight.service'
import type { AiStreamEvent } from '../ai-inflight/ai-inflight.types'
import { normalizeTargetLangs } from '../ai-language.util'
import type {
  MultilangAdapter,
  MultilangTaskResult,
} from './ai-multilang.types'

const STREAM_DEFAULTS = {
  lockTtlSec: AI_STREAM_LOCK_TTL,
  resultTtlSec: AI_STREAM_RESULT_TTL,
  streamMaxLen: AI_STREAM_MAXLEN,
  readBlockMs: AI_STREAM_READ_BLOCK_MS,
  idleTimeoutMs: AI_STREAM_IDLE_TIMEOUT_MS,
}

@Injectable()
export class MultilangGenerationService {
  constructor(
    private readonly aiInFlightService: AiInFlightService,
    private readonly generationMetrics: AiGenerationMetricsService,
    private readonly configService: ConfigsService,
  ) {}

  serializeText(text: string): string {
    return removeMdCodeblock(text)
  }

  computeContentHash(text: string): string {
    return md5(this.serializeText(text))
  }

  runBaseGeneration<TArticle, TDoc>(
    adapter: MultilangAdapter<TArticle, TDoc>,
    options: {
      refId: string
      lang: string
      article: TArticle
      text: string
      onToken?: (count?: number) => Promise<void>
      onCost?: (usd: number) => Promise<void>
      taskId?: string
      force?: boolean
    },
  ): Promise<{
    events: AsyncIterable<AiStreamEvent>
    result: Promise<TDoc>
  }> {
    const text = this.serializeText(options.text)
    const key = md5(
      JSON.stringify({
        feature: adapter.feature,
        articleId: options.refId,
        lang: options.lang,
        textHash: md5(text),
      }),
    )

    return this.aiInFlightService.runWithStream<TDoc>({
      key,
      ...STREAM_DEFAULTS,
      bypassResultCache: options.force,
      onLeader: async ({ push }) => {
        const generated = await adapter.generate(
          options.article,
          options.lang,
          push,
          options.onToken,
          options.onCost,
        )
        const contentMd5 = md5(text)
        await adapter.deleteStaleTranslations(options.refId, contentMd5)
        const doc = await adapter.persistBase({
          refId: options.refId,
          lang: options.lang,
          hash: contentMd5,
          content: generated.content,
        })
        const view = adapter.readDoc(doc)
        await this.generationMetrics.record({
          resourceType: adapter.feature,
          resourceId: view.id,
          refId: options.refId,
          lang: options.lang,
          taskId: options.taskId ?? null,
          providerId: generated.providerId,
          model: generated.model,
          usage: generated.usage,
        })
        adapter.emitGenerated(doc, {
          refId: options.refId,
          sourceLang: options.lang,
          sourceHash: contentMd5,
        })
        return { result: doc, resultId: view.id }
      },
      parseResult: async (resultId) => {
        const doc = await adapter.findById(resultId)
        if (!doc) {
          throw createAppException(AppErrorCode.CONTENT_NOT_FOUND_CANT_PROCESS)
        }
        return doc
      },
    })
  }

  async runTranslation<TArticle, TDoc>(
    adapter: MultilangAdapter<TArticle, TDoc>,
    options: {
      refId: string
      base: TDoc
      targetLang: string
      force?: boolean
      taskId?: string
      onCost?: (usd: number) => Promise<void>
    },
  ): Promise<TDoc> {
    const base = adapter.readDoc(options.base)
    if (!options.force) {
      const existing = await adapter.findByRefAndLang(
        options.refId,
        options.targetLang,
      )
      if (existing) {
        const view = adapter.readDoc(existing)
        if (view.isTranslation && view.hash === base.hash) return existing
      }
    }

    const key = md5(
      JSON.stringify({
        feature: `${adapter.feature}.translation`,
        refId: options.refId,
        lang: options.targetLang,
        sourceHash: base.hash,
      }),
    )

    const { result } = await this.aiInFlightService.runWithStream<TDoc>({
      key,
      ...STREAM_DEFAULTS,
      bypassResultCache: options.force,
      onLeader: async ({ push }) => {
        const generated = await adapter.translate(
          base.content,
          options.targetLang,
          push,
        )
        const doc = await adapter.persistTranslation({
          refId: options.refId,
          lang: options.targetLang,
          hash: base.hash,
          content: generated.content,
          sourceId: base.id,
          sourceLang: base.sourceLang || base.lang,
        })
        const view = adapter.readDoc(doc)
        await this.generationMetrics.record({
          resourceType: adapter.feature,
          resourceId: view.id,
          refId: options.refId,
          lang: options.targetLang,
          taskId: options.taskId ?? null,
          providerId: generated.providerId,
          model: generated.model,
          usage: generated.usage,
        })
        const totalCost = generated.usage.cost?.total ?? 0
        if (options.onCost && totalCost > 0) await options.onCost(totalCost)
        return { result: doc, resultId: view.id }
      },
      parseResult: async (resultId) => {
        const doc = await adapter.findById(resultId)
        if (!doc) {
          throw createAppException(AppErrorCode.CONTENT_NOT_FOUND_CANT_PROCESS)
        }
        return doc
      },
    })
    return result
  }

  async executeMultilangTask<TArticle, TDoc>(
    adapter: MultilangAdapter<TArticle, TDoc>,
    payload: { refId: string; targetLanguages?: string[]; force?: boolean },
    context: TaskExecuteContext,
  ): Promise<MultilangTaskResult<TDoc>> {
    if (context.isAborted()) throw createAbortError()
    await adapter.assertEnabled()

    const { article, text, sourceLang } = await adapter.resolveArticle(
      payload.refId,
    )
    const targets = normalizeTargetLangs(payload.targetLanguages).filter(
      (lang) => lang !== sourceLang,
    )
    const totalItems = 1 + targets.length
    await context.updateProgress(
      0,
      `Generating ${adapter.feature} (${sourceLang})`,
      0,
      totalItems,
    )

    const contentHash = this.computeContentHash(text)
    let baseDoc = await adapter.findBase(payload.refId, sourceLang)
    const reusable =
      baseDoc && !payload.force && adapter.readDoc(baseDoc).hash === contentHash
    if (!reusable) {
      const { result } = await this.runBaseGeneration(adapter, {
        refId: payload.refId,
        lang: sourceLang,
        article,
        text,
        onToken: context.incrementTokens,
        onCost: context.incrementCost,
        taskId: context.taskId,
        force: payload.force,
      })
      baseDoc = await result
    }
    let completed = 1
    await context.updateProgress(
      Math.round((completed / totalItems) * 100),
      `Base ready (${sourceLang})`,
      completed,
      totalItems,
    )

    const translated: Array<{ doc: TDoc; lang: string }> = []
    const failedLangs: string[] = []

    if (targets.length) {
      const aiConfig = await this.configService.get('ai')
      const limit = pLimit(
        Math.max(1, Math.min(10, aiConfig.translationLangConcurrency ?? 3)),
      )
      await Promise.all(
        targets.map((targetLang) =>
          limit(async () => {
            if (context.isAborted()) throw createAbortError()
            try {
              const doc = await this.runTranslation(adapter, {
                refId: payload.refId,
                base: baseDoc!,
                targetLang,
                force: payload.force,
                taskId: context.taskId,
                onCost: context.incrementCost,
              })
              translated.push({ doc, lang: targetLang })
            } catch (error) {
              if ((error as Error).name === 'AbortError') throw error
              failedLangs.push(targetLang)
              await context.appendLog(
                'error',
                `Failed to translate ${adapter.feature} to ${targetLang}: ${(error as Error).message}`,
              )
            }
            completed++
            await context.updateProgress(
              Math.round((completed / totalItems) * 100),
              `Processed ${completed}/${totalItems}`,
              completed,
              totalItems,
            )
          }),
        ),
      )
    }

    if (failedLangs.length) {
      context.setStatus(TaskStatus.PartialFailed)
    }

    return { base: baseDoc!, sourceLang, translated, failedLangs }
  }
}
