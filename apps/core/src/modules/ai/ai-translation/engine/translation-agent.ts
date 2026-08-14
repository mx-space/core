import { Logger } from '@nestjs/common'

import { AI_PROMPTS } from '../../ai.prompts'
import { runEngineLoop } from '../../message-engine/loop/agent-loop'
import type { SubAgentSpec } from '../../message-engine/tools/sub-agent'
import { VirtualFs } from '../../message-engine/vfs/virtual-fs'
import type { IModelRuntime } from '../../runtime'
import {
  buildReviewerMetrics,
  emptyEditorMetrics,
  emptyReviewerMetrics,
} from '../strategies/base-translation-strategy'
import type { PipelineMetrics } from '../translation-strategy.interface'
import type { TranslationUnit } from '../translation-unit.types'
import { flatIdsOf, unitsToSourceMap } from '../translation-unit.types'
import { shouldUseChunkedTranslation } from './translation-chunk-planner'
import { createTranslationConversation } from './translation-context'
import { runChunkedTranslationAgent } from './translation-coordinator'
import { createTranslationTools, TRANSLATION_FILE } from './translation-tools'

export const AGENT_MAX_STEPS = 12
export const AGENT_MAX_REVIEW_ROUNDS = 3

const logger = new Logger('TranslationAgent')

export async function runTranslationAgent(opts: {
  targetLang: string
  units: TranslationUnit[]
  documentContext: string
  styleHints?: string
  runtime: IModelRuntime
  reviewerRuntime?: IModelRuntime
  signal?: AbortSignal
  onToken?: () => Promise<void>
  onCost?: (usd: number) => Promise<void>
  onSegments?: (segments: Record<string, string>) => Promise<void>
  metrics?: PipelineMetrics
}): Promise<{ sourceLang: string; translations: Map<string, string> }> {
  const {
    targetLang,
    units,
    documentContext,
    styleHints,
    runtime,
    reviewerRuntime,
    signal,
    onToken,
    onCost,
    onSegments,
    metrics,
  } = opts
  if (typeof runtime.streamMessage !== 'function') {
    throw new TypeError('runtime does not implement streamMessage')
  }

  if (shouldUseChunkedTranslation(units)) {
    logger.log(
      `Long document detected: units=${units.length}; using translation coordinator`,
    )
    return runChunkedTranslationAgent({
      targetLang,
      units,
      documentContext,
      styleHints,
      runtime,
      reviewerRuntime,
      signal,
      onToken,
      onCost,
      onSegments,
      metrics,
    })
  }

  const vfs = new VirtualFs()
  let reviewer: SubAgentSpec | undefined
  if (reviewerRuntime) {
    const reviewerPrompt = AI_PROMPTS.translationReviewer(targetLang, {
      allowedIds: [],
      segments: {},
      styleHints,
    })
    reviewer = {
      runtime: reviewerRuntime,
      systemPrompt: reviewerPrompt.systemPrompt,
      reasoningEffort: reviewerPrompt.reasoningEffort,
    }
  }

  const { tools, state } = createTranslationTools({
    vfs,
    units,
    targetLang,
    styleHints,
    reviewer,
    onSegments,
    signal,
  })
  const conversation = createTranslationConversation({
    targetLang,
    documentContext,
    units,
    styleHints,
    reviewEnabled: Boolean(reviewerRuntime),
  })

  const loopStart = Date.now()
  const loop = await runEngineLoop({
    runtime,
    conversation,
    tools,
    guards: {
      maxSteps: AGENT_MAX_STEPS,
      toolInvocationLimits: { request_review: AGENT_MAX_REVIEW_ROUNDS },
    },
    signal,
    onToken,
    onCost,
  })
  logger.log(
    `Agent loop finished: reason=${loop.finishReason} steps=${loop.steps} reviews=${state.reviewRounds}`,
  )

  const file = vfs.read(TRANSLATION_FILE)
  const sources = unitsToSourceMap(units)
  const translations = new Map<string, string>()
  for (const id of flatIdsOf(units)) {
    if (file[id] !== undefined) {
      translations.set(id, file[id])
      continue
    }
    logger.warn(
      `Translation missing for segment ${id} after agent loop, falling back to original`,
    )
    translations.set(id, sources[id])
  }

  if (metrics) {
    metrics.writerMs =
      state.firstWriteAt === null ? 0 : state.firstWriteAt - loopStart
    if (!reviewerRuntime) {
      metrics.reviewer = emptyReviewerMetrics('review-disabled')
    } else if (state.reviewerFailed) {
      metrics.reviewer = {
        ...emptyReviewerMetrics('reviewer-failed'),
        invoked: true,
        durationMs: state.reviewerMs,
        rounds: state.reviewRounds,
      }
    } else if (state.reviewRounds === 0) {
      metrics.reviewer = emptyReviewerMetrics('model-skipped-review')
    } else {
      metrics.reviewer = {
        ...buildReviewerMetrics(state.reviewerMs, {
          issues: state.lastIssues,
        }),
        rounds: state.reviewRounds,
      }
    }
    metrics.editor =
      state.patchesApplied.length > 0
        ? {
            invoked: true,
            durationMs: 0,
            skippedReason: null,
            patchKeysRequested: state.patchKeysRequested,
            patchKeysApplied: state.patchesApplied.map((patch) => patch.id),
            patchKeysDropped: state.patchKeysDropped,
            patches: state.patchesApplied,
          }
        : emptyEditorMetrics(
            !reviewerRuntime
              ? 'review-disabled'
              : state.reviewRounds > 0 && state.lastIssues.length === 0
                ? 'empty-issues'
                : 'editor-skipped',
          )
  }

  return { sourceLang: state.sourceLang ?? '', translations }
}
