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
import type {
  ITranslationStrategy,
  PipelineMetrics,
  TranslationResult,
  TranslationStrategyOptions,
} from '../translation-strategy.interface'
import {
  BaseTranslationStrategy,
  buildReviewerMetrics,
  DEFAULT_REVIEW_SCORE_THRESHOLD,
  emptyEditorMetrics,
  emptyReviewerMetrics,
} from './base-translation-strategy'

const META_TITLE_KEY = '__title__'
const META_SUBTITLE_KEY = '__subtitle__'
const META_SUMMARY_KEY = '__summary__'
const META_TAGS_KEY = '__tags__'

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
      fullTranslations[META_TAGS_KEY] = initial.tags.join('|||')
    }
    for (const paragraph of paragraphs) {
      fullTranslations[paragraph.id] = paragraph.text
    }

    const allowedIds = Object.keys(fullTranslations)
    const reviewerStart = Date.now()
    const review = await this.reviewerService.callReviewer(
      reviewerRuntime,
      targetLang,
      { allowedIds, fullTranslations },
      signal,
    )
    const reviewerMs = Date.now() - reviewerStart

    if (!review) {
      this.logger.warn('Reviewer returned null; persisting writer output as-is')
      if (metrics) {
        metrics.reviewer = {
          ...emptyReviewerMetrics('reviewer-failed'),
          invoked: true,
          durationMs: reviewerMs,
        }
        metrics.editor = emptyEditorMetrics('reviewer-failed')
      }
      return initial
    }

    if (review.score >= scoreThreshold || review.issues.length === 0) {
      this.logger.log(
        `Review pass: score=${review.score} issues=${review.issues.length}; edit skipped`,
      )
      if (metrics) {
        metrics.reviewer = buildReviewerMetrics(reviewerMs, review)
        metrics.editor = emptyEditorMetrics(
          review.issues.length === 0 ? 'empty-issues' : 'score-above-threshold',
        )
      }
      return initial
    }

    const editorStart = Date.now()
    const editor = await this.callEditor(
      targetLang,
      { fullTranslations, issues: review.issues },
      translatorRuntime,
      signal,
    )
    const editorMs = Date.now() - editorStart

    if (!editor) {
      this.logger.warn('Editor returned null; persisting writer output as-is')
      if (metrics) {
        metrics.reviewer = buildReviewerMetrics(reviewerMs, review)
        metrics.editor = {
          ...emptyEditorMetrics('editor-failed'),
          durationMs: editorMs,
        }
      }
      return initial
    }

    let nextTitle = initial.title
    let nextSubtitle = initial.subtitle
    let nextSummary = initial.summary
    let nextTags = initial.tags
    const paragraphPatches: Record<string, string> = {}
    const dropped: string[] = []
    const applied: string[] = []
    const patchSamples: Array<{ id: string; before: string; after: string }> =
      []
    const allowedSet = new Set(allowedIds)
    const patchKeysRequested = Object.keys(editor.patches)

    for (const [id, patched] of Object.entries(editor.patches)) {
      if (!allowedSet.has(id)) {
        dropped.push(id)
        continue
      }
      let handled = true
      switch (id) {
        case META_TITLE_KEY: {
          nextTitle = patched
          break
        }
        case META_SUBTITLE_KEY: {
          nextSubtitle = patched
          break
        }
        case META_SUMMARY_KEY: {
          nextSummary = patched
          break
        }
        case META_TAGS_KEY: {
          nextTags = patched.split('|||')
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
        applied.push(id)
        patchSamples.push({
          id,
          before: fullTranslations[id] ?? '',
          after: patched,
        })
      }
    }

    let nextText = initial.text
    if (Object.keys(paragraphPatches).length > 0) {
      const result = applyParagraphPatches(initial.text, paragraphPatches)
      nextText = result.joined
      for (const unknown of result.unknownIds) dropped.push(unknown)
    }

    if (dropped.length > 0) {
      this.logger.warn(
        `Editor produced ${dropped.length} out-of-set patches: ${dropped.slice(0, 5).join(', ')}`,
      )
    }

    if (metrics) {
      metrics.reviewer = buildReviewerMetrics(reviewerMs, review)
      metrics.editor = {
        invoked: true,
        durationMs: editorMs,
        skippedReason: null,
        patchKeysRequested,
        patchKeysApplied: applied,
        patchKeysDropped: dropped,
        patches: patchSamples,
      }
    }

    this.logger.log(
      `Edit applied: title=${nextTitle !== initial.title} text=${nextText !== initial.text} subtitle=${nextSubtitle !== initial.subtitle} summary=${nextSummary !== initial.summary} tags=${nextTags !== initial.tags}`,
    )

    return {
      title: nextTitle,
      text: nextText,
      subtitle: nextSubtitle,
      summary: nextSummary,
      tags: nextTags,
    }
  }
}
