import { Injectable } from '@nestjs/common'

import { throwIfAborted } from '~/utils/abort.util'

import { AI_PROMPTS } from '../../ai.prompts'
import type { IModelRuntime } from '../../runtime'
import type { ArticleContent } from '../ai-translation.types'
import {
  applyParagraphPatches,
  splitMarkdownIntoParagraphs,
} from '../markdown-paragraph-splitter'
import { TranslationReviewerService } from '../reviewer.service'
import {
  decodeTags,
  encodeTags,
  META_SUBTITLE_KEY,
  META_SUMMARY_KEY,
  META_TAGS_KEY,
  META_TITLE_KEY,
} from '../translation-meta'
import type {
  ITranslationStrategy,
  PipelineMetrics,
  TranslationResult,
  TranslationStrategyOptions,
} from '../translation-strategy.interface'
import {
  BaseTranslationStrategy,
  DEFAULT_REVIEW_SCORE_THRESHOLD,
  emptyEditorMetrics,
  emptyReviewerMetrics,
} from './base-translation-strategy'

@Injectable()
export class MarkdownTranslationStrategy
  extends BaseTranslationStrategy
  implements ITranslationStrategy
{
  constructor(private readonly reviewerService: TranslationReviewerService) {
    super(MarkdownTranslationStrategy.name)
  }

  async translate(
    content: ArticleContent,
    targetLang: string,
    runtime: IModelRuntime,
    info: { model: string; provider: string },
    options: TranslationStrategyOptions,
  ): Promise<TranslationResult> {
    const {
      push,
      onToken,
      onCost,
      signal,
      reviewerRuntime,
      reviewScoreThreshold,
      metrics,
    } = options

    const { systemPrompt, prompt, reasoningEffort } =
      AI_PROMPTS.translationStream(targetLang, {
        title: content.title,
        text: content.text,
        subtitle: content.subtitle ?? undefined,
        summary: content.summary ?? undefined,
        tags: content.tags,
      })

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: prompt },
    ]

    const writerStart = Date.now()
    let fullText = ''
    let totalTokens = 0
    let totalCost = 0
    if (runtime.streamMessage) {
      const events = runtime.streamMessage({
        messages,
        temperature: 0.3,
        maxRetries: 2,
        reasoningEffort,
        signal,
      })
      for await (const event of events) {
        throwIfAborted(signal)
        if (event.type === 'text_delta') {
          const delta = event.delta
          if (typeof delta !== 'string' || delta.length === 0) continue
          fullText += delta
          if (push) {
            await push({ type: 'token', data: delta })
          }
        } else if (
          event.type === 'thinking_delta' ||
          event.type === 'toolcall_start' ||
          event.type === 'toolcall_delta' ||
          event.type === 'toolcall_end'
        ) {
          this.logger.debug(`stream non-text event filtered: ${event.type}`)
        } else if (event.type === 'done') {
          totalTokens = event.message.usage?.totalTokens ?? 0
          totalCost = event.message.usage?.cost?.total ?? 0
        } else if (event.type === 'error') {
          throw new Error(
            event.error.errorMessage || 'AI translation stream error',
          )
        }
      }
    } else {
      const result = await runtime.generateText({
        messages,
        temperature: 0.3,
        maxRetries: 2,
        reasoningEffort,
        signal,
      })
      fullText = result.text
      totalTokens = result.usage?.totalTokens ?? 0
      totalCost = result.usage?.cost ?? 0
      if (push && result.text) {
        await push({ type: 'token', data: result.text })
      }
    }
    if (onToken) {
      await onToken(totalTokens)
    }
    if (onCost && totalCost > 0) {
      await onCost(totalCost)
    }

    const parsed = this.parseModelJson<{
      sourceLang?: string
      title?: string
      text?: string
      subtitle?: string | null
      summary?: string | null
      tags?: string[] | null
    }>(fullText, 'translateMarkdownContent')

    if (!parsed?.title || !parsed?.text || !parsed?.sourceLang) {
      throw new Error('Invalid translation JSON response')
    }

    if (metrics) metrics.writerMs = Date.now() - writerStart

    let finalTitle = parsed.title
    let finalText = parsed.text
    let finalSubtitle: string | null = parsed.subtitle ?? null
    let finalSummary: string | null = parsed.summary ?? null
    let finalTags: string[] | null = parsed.tags ?? null

    if (reviewerRuntime) {
      const reviewed = await this.runReviewAndEdit(
        targetLang,
        runtime,
        reviewerRuntime,
        {
          title: finalTitle,
          text: finalText,
          subtitle: finalSubtitle,
          summary: finalSummary,
          tags: finalTags,
        },
        reviewScoreThreshold ?? DEFAULT_REVIEW_SCORE_THRESHOLD,
        signal,
        metrics,
      )
      finalTitle = reviewed.title
      finalText = reviewed.text
      finalSubtitle = reviewed.subtitle
      finalSummary = reviewed.summary
      finalTags = reviewed.tags
    } else if (metrics) {
      metrics.reviewer = emptyReviewerMetrics('review-disabled')
      metrics.editor = emptyEditorMetrics('review-disabled')
    }

    return {
      sourceLang: parsed.sourceLang,
      title: finalTitle,
      text: finalText,
      subtitle: finalSubtitle,
      summary: finalSummary,
      tags: finalTags,
      aiModel: info.model,
      aiProvider: info.provider,
    }
  }

  private async runReviewAndEdit(
    targetLang: string,
    translatorRuntime: IModelRuntime,
    reviewerRuntime: IModelRuntime,
    initial: {
      title: string
      text: string
      subtitle: string | null
      summary: string | null
      tags: string[] | null
    },
    scoreThreshold: number,
    signal?: AbortSignal,
    metrics?: PipelineMetrics,
  ): Promise<{
    title: string
    text: string
    subtitle: string | null
    summary: string | null
    tags: string[] | null
  }> {
    const paragraphs = splitMarkdownIntoParagraphs(initial.text)
    const fullTranslations: Record<string, string> = {
      [META_TITLE_KEY]: initial.title,
    }
    if (initial.subtitle) {
      fullTranslations[META_SUBTITLE_KEY] = initial.subtitle
    }
    if (initial.summary) {
      fullTranslations[META_SUMMARY_KEY] = initial.summary
    }
    if (initial.tags?.length) {
      fullTranslations[META_TAGS_KEY] = encodeTags(initial.tags)
    }
    for (const paragraph of paragraphs) {
      fullTranslations[paragraph.id] = paragraph.text
    }

    const allowedIds = Object.keys(fullTranslations)
    const allowedSet = new Set(allowedIds)
    const next = { ...initial }

    await this.runReviewAndEditPipeline({
      targetLang,
      translatorRuntime,
      reviewerRuntime,
      reviewerService: this.reviewerService,
      fullTranslations,
      allowedIds,
      scoreThreshold,
      signal,
      metrics,
      applyPatches: (rawPatches) => {
        const paragraphPatches: Record<string, string> = {}
        const patchKeysDropped: string[] = []
        const patchKeysApplied: string[] = []
        const patches: Array<{ id: string; before: string; after: string }> = []

        for (const [id, patched] of Object.entries(rawPatches)) {
          if (!allowedSet.has(id)) {
            patchKeysDropped.push(id)
            continue
          }
          let handled = true
          switch (id) {
            case META_TITLE_KEY: {
              next.title = patched
              break
            }
            case META_SUBTITLE_KEY: {
              next.subtitle = patched
              break
            }
            case META_SUMMARY_KEY: {
              next.summary = patched
              break
            }
            case META_TAGS_KEY: {
              next.tags = decodeTags(patched)
              break
            }
            default: {
              if (id.startsWith('text:p')) {
                paragraphPatches[id] = patched
              } else {
                handled = false
              }
            }
          }
          if (handled) {
            patchKeysApplied.push(id)
            patches.push({
              id,
              before: fullTranslations[id] ?? '',
              after: patched,
            })
          }
        }

        if (Object.keys(paragraphPatches).length > 0) {
          const result = applyParagraphPatches(initial.text, paragraphPatches)
          next.text = result.joined
          for (const unknown of result.unknownIds) {
            patchKeysDropped.push(unknown)
          }
        }

        return { patchKeysApplied, patchKeysDropped, patches }
      },
    })

    return next
  }
}
