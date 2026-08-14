import { Type } from '@earendil-works/pi-ai'
import { Logger } from '@nestjs/common'

import { AI_PROMPTS } from '../../ai.prompts'
import { runEngineLoop } from '../../message-engine/loop/agent-loop'
import type { SubAgentSpec } from '../../message-engine/tools/sub-agent'
import { invokeSubAgent } from '../../message-engine/tools/sub-agent'
import type { EngineTool } from '../../message-engine/tools/tool.types'
import { VirtualFs } from '../../message-engine/vfs/virtual-fs'
import type { IModelRuntime, RuntimeUsage } from '../../runtime'
import {
  buildReviewerMetrics,
  emptyEditorMetrics,
  emptyReviewerMetrics,
} from '../strategies/base-translation-strategy'
import type { PipelineMetrics } from '../translation-strategy.interface'
import type { TranslationUnit } from '../translation-unit.types'
import {
  flatIdsOf,
  flattenUnitTranslations,
  unitsToEntries,
  unitsToMeta,
  unitsToSourceMap,
} from '../translation-unit.types'
import type { TranslationChunk } from './translation-chunk-planner'
import { planTranslationChunks } from './translation-chunk-planner'
import { createTranslationCoordinatorConversation } from './translation-context'
import {
  createTranslationTools,
  TRANSLATION_FILE,
  type TranslationToolState,
} from './translation-tools'

const logger = new Logger('TranslationCoordinator')

export const TRANSLATION_SUB_AGENT_CONCURRENCY = 3
export const TRANSLATION_SUB_AGENT_MAX_ATTEMPTS = 2
export const TRANSLATION_SUB_AGENT_TIMEOUT_MS = 300_000
export const TRANSLATION_COORDINATOR_MAX_STEPS = 12
export const TRANSLATION_SUB_AGENT_CONTEXT_MAX_CHARS = 3_000

type ChunkStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface TranslationChunkProgress {
  status: ChunkStatus
  attempts: number
  error?: string
}

export interface TranslationCoordinatorState {
  chunks: Record<string, TranslationChunkProgress>
  translation: TranslationToolState
}

const usageCost = (usage: RuntimeUsage | undefined) =>
  usage?.costBreakdown?.total ?? usage?.cost ?? 0

const usageOutputTokens = (usage: RuntimeUsage | undefined) =>
  usage?.completionTokens ?? usage?.outputTokens

const unitSourceText = (unit: TranslationUnit) =>
  typeof unit.payload === 'string'
    ? unit.payload
    : unit.payload.segments.map((segment) => segment.text).join('')

const compactContextPart = (label: string, value: string, limit: number) => {
  const normalized = value.trim()
  if (!normalized) return ''
  const content =
    normalized.length <= limit
      ? normalized
      : `${normalized.slice(0, limit)}\n[context truncated]`
  return `## ${label}\n${content}`
}

const buildSubAgentDocumentContext = (opts: {
  chunk: TranslationChunk
  chunks: readonly TranslationChunk[]
  allUnits: readonly TranslationUnit[]
  documentContext: string
}) => {
  const { chunk, chunks, allUnits, documentContext } = opts
  const index = chunks.findIndex((item) => item.id === chunk.id)
  const metadata = allUnits
    .filter((unit) => unit.meta.startsWith('meta.'))
    .map((unit) => `${unit.meta}: ${unitSourceText(unit)}`)
    .join('\n')
  const previous = chunks[index - 1]?.units.at(-1)
  const next = chunks[index + 1]?.units[0]
  return [
    compactContextPart('Document metadata', metadata, 1_000),
    compactContextPart('Document opening', documentContext, 1_000),
    compactContextPart(
      'Previous chunk tail',
      previous ? unitSourceText(previous).slice(-500) : '',
      500,
    ),
    compactContextPart(
      'Next chunk opening',
      next ? unitSourceText(next) : '',
      500,
    ),
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, TRANSLATION_SUB_AGENT_CONTEXT_MAX_CHARS)
}

async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
) {
  let cursor = 0
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const item = items[cursor++]
        await worker(item)
      }
    },
  )
  await Promise.all(workers)
}

export function createTranslationCoordinatorTools(opts: {
  chunks: TranslationChunk[]
  allUnits: TranslationUnit[]
  targetLang: string
  documentContext: string
  styleHints?: string
  runtime: IModelRuntime
  reviewer?: SubAgentSpec
  signal?: AbortSignal
  onToken?: (count?: number) => Promise<void>
  onCost?: (usd: number) => Promise<void>
  onSegments?: (segments: Record<string, string>) => Promise<void>
}): {
  tools: EngineTool[]
  state: TranslationCoordinatorState
  vfs: VirtualFs
} {
  const {
    chunks,
    allUnits,
    targetLang,
    documentContext,
    styleHints,
    runtime,
    reviewer,
    signal,
    onToken,
    onCost,
    onSegments,
  } = opts
  const vfs = new VirtualFs()
  const reviewTools = createTranslationTools({
    vfs,
    units: allUnits,
    targetLang,
    styleHints,
    reviewer,
    reviewWindows: chunks.map((chunk) => flatIdsOf(chunk.units)),
    onSegments,
    signal,
  })
  const chunkById = new Map(chunks.map((chunk) => [chunk.id, chunk]))
  const chunksState = Object.fromEntries(
    chunks.map((chunk) => [
      chunk.id,
      { status: 'pending' as const, attempts: 0 },
    ]),
  )

  const state: TranslationCoordinatorState = {
    chunks: chunksState,
    translation: reviewTools.state,
  }

  const executeChunk = async (
    chunk: TranslationChunk,
    execSignal?: AbortSignal,
  ) => {
    const progress = state.chunks[chunk.id]
    if (progress.status === 'completed') return
    progress.status = 'running'
    delete progress.error

    const prompt = AI_PROMPTS.translationChunk(targetLang, {
      documentContext: buildSubAgentDocumentContext({
        chunk,
        chunks,
        allUnits,
        documentContext,
      }),
      textEntries: unitsToEntries(chunk.units),
      segmentMeta: unitsToMeta(chunk.units),
      ...(styleHints ? { styleHints } : {}),
    })
    const expectedIds = flatIdsOf(chunk.units)

    for (
      let attempt = 1;
      attempt <= TRANSLATION_SUB_AGENT_MAX_ATTEMPTS;
      attempt++
    ) {
      progress.attempts++
      try {
        const output = await invokeSubAgent(
          {
            runtime,
            systemPrompt: prompt.systemPrompt,
            reasoningEffort: prompt.reasoningEffort,
            timeoutMs: TRANSLATION_SUB_AGENT_TIMEOUT_MS,
          },
          {
            prompt: prompt.prompt,
            schema: prompt.schema,
            signal: execSignal ?? signal,
            onUsage: async (usage) => {
              const tokens = usageOutputTokens(usage)
              if (onToken) await onToken(tokens)
              const cost = usageCost(usage)
              if (onCost && cost > 0) await onCost(cost)
            },
          },
        )
        const result = output as {
          sourceLang: string
          translations: Record<string, unknown>
        }
        const resolved = flattenUnitTranslations(
          chunk.units,
          result.translations,
        )
        const missing = expectedIds.filter((id) => resolved[id] === undefined)
        if (missing.length > 0) {
          throw new Error(`missing translated ids: ${missing.join(', ')}`)
        }
        vfs.write(TRANSLATION_FILE, {
          ...vfs.read(TRANSLATION_FILE),
          ...resolved,
        })
        if (!state.translation.sourceLang) {
          state.translation.sourceLang = result.sourceLang
        } else if (state.translation.sourceLang !== result.sourceLang) {
          logger.warn(
            `Source language mismatch: expected=${state.translation.sourceLang} chunk=${chunk.id} received=${result.sourceLang}`,
          )
        }
        if (state.translation.firstWriteAt === null) {
          state.translation.firstWriteAt = Date.now()
        }
        if (onSegments) await onSegments(resolved)
        progress.status = 'completed'
        return
      } catch (error) {
        if (
          execSignal?.aborted ||
          signal?.aborted ||
          (error instanceof DOMException && error.name === 'AbortError')
        ) {
          throw error
        }
        progress.error = error instanceof Error ? error.message : String(error)
        logger.warn(
          `Chunk translation failed: chunk=${chunk.id} attempt=${attempt}/${TRANSLATION_SUB_AGENT_MAX_ATTEMPTS} error=${progress.error}`,
        )
      }
    }
    progress.status = 'failed'
  }

  const statusContent = () => {
    const grouped: Record<ChunkStatus, string[]> = {
      pending: [],
      running: [],
      completed: [],
      failed: [],
    }
    for (const [id, progress] of Object.entries(state.chunks)) {
      grouped[progress.status].push(id)
    }
    const translated = vfs.read(TRANSLATION_FILE)
    return {
      ...grouped,
      missingSegments: flatIdsOf(allUnits).filter(
        (id) => translated[id] === undefined,
      ).length,
    }
  }

  const translateChunks: EngineTool = {
    name: 'translate_chunks',
    description:
      'Delegate selected long-document chunks to isolated translation sub-agents. The tool enforces bounded concurrency and returns status only, never translated text.',
    parameters: Type.Object(
      {
        chunkIds: Type.Array(Type.String(), {
          minItems: 1,
          maxItems: chunks.length,
        }),
      },
      { additionalProperties: false },
    ),
    execute: async (args, execSignal) => {
      const requested = [...new Set((args as { chunkIds: string[] }).chunkIds)]
      const unknown = requested.filter((id) => !chunkById.has(id))
      if (unknown.length > 0) {
        return {
          content: JSON.stringify({ unknown }),
          isError: true,
        }
      }
      const selected = requested
        .map((id) => chunkById.get(id)!)
        .filter((chunk) => state.chunks[chunk.id].status !== 'completed')
      await runWithConcurrency(
        selected,
        TRANSLATION_SUB_AGENT_CONCURRENCY,
        (chunk) => executeChunk(chunk, execSignal),
      )
      return { content: JSON.stringify(statusContent()) }
    },
  }

  const translationStatus: EngineTool = {
    name: 'translation_status',
    description:
      'Read compact long-document translation coverage and chunk state. It never returns source text or translated text.',
    parameters: Type.Object({}, { additionalProperties: false }),
    execute: async () => ({ content: JSON.stringify(statusContent()) }),
  }

  const tools: EngineTool[] = [translateChunks, translationStatus]
  if (reviewer) {
    const sources = unitsToSourceMap(allUnits)
    const readSegments: EngineTool = {
      name: 'read_translation_segments',
      description:
        'Read a small targeted set of source and translated segments before applying review patches.',
      parameters: Type.Object(
        {
          ids: Type.Array(Type.String(), { minItems: 1, maxItems: 20 }),
        },
        { additionalProperties: false },
      ),
      execute: async (args) => {
        const current = vfs.read(TRANSLATION_FILE)
        const ids = [...new Set((args as { ids: string[] }).ids)]
        const segments = Object.fromEntries(
          ids
            .filter((id) => sources[id] !== undefined)
            .map((id) => [
              id,
              { source: sources[id], target: current[id] ?? null },
            ]),
        )
        return { content: JSON.stringify({ segments }) }
      },
    }
    tools.push(readSegments)
    const patch = reviewTools.tools.find(
      (tool) => tool.name === 'patch_translation',
    )
    const review = reviewTools.tools.find(
      (tool) => tool.name === 'request_review',
    )
    if (patch) tools.push(patch)
    if (review) tools.push(review)
  }

  return { tools, state, vfs }
}

export async function runChunkedTranslationAgent(opts: {
  targetLang: string
  units: TranslationUnit[]
  documentContext: string
  styleHints?: string
  runtime: IModelRuntime
  reviewerRuntime?: IModelRuntime
  signal?: AbortSignal
  onToken?: (count?: number) => Promise<void>
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
  const chunks = planTranslationChunks(units)
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
  const created = createTranslationCoordinatorTools({
    chunks,
    allUnits: units,
    targetLang,
    documentContext,
    styleHints,
    runtime,
    reviewer,
    signal,
    onToken,
    onCost,
    onSegments,
  })
  const conversation = createTranslationCoordinatorConversation({
    targetLang,
    chunks,
    reviewEnabled: Boolean(reviewer),
  })
  const loopStart = Date.now()
  const loop = await runEngineLoop({
    runtime,
    conversation,
    tools: created.tools,
    guards: {
      maxSteps: TRANSLATION_COORDINATOR_MAX_STEPS,
      toolInvocationLimits: {
        translate_chunks: 3,
        request_review: 3,
        read_translation_segments: 3,
      },
    },
    signal,
    onToken,
    onCost,
  })
  logger.log(
    `Coordinator finished: reason=${loop.finishReason} steps=${loop.steps} chunks=${chunks.length}`,
  )

  const pendingChunkIds = Object.entries(created.state.chunks)
    .filter(([, progress]) => progress.status === 'pending')
    .map(([id]) => id)
  if (pendingChunkIds.length > 0) {
    logger.warn(
      `Coordinator left ${pendingChunkIds.length} chunks pending; executing the pending manifest directly`,
    )
    const translateChunks = created.tools.find(
      (tool) => tool.name === 'translate_chunks',
    )!
    await translateChunks.execute({ chunkIds: pendingChunkIds }, signal)
  }
  const incompleteChunks = Object.entries(created.state.chunks).filter(
    ([, progress]) => progress.status !== 'completed',
  )
  if (incompleteChunks.length > 0) {
    throw new Error(
      `Long-document translation incomplete: ${incompleteChunks
        .map(([id, progress]) => `${id} (${progress.error ?? progress.status})`)
        .join(', ')}`,
    )
  }

  const file = created.vfs.read(TRANSLATION_FILE)
  const sources = unitsToSourceMap(units)
  const translations = new Map<string, string>()
  for (const id of flatIdsOf(units)) {
    if (file[id] !== undefined) {
      translations.set(id, file[id])
      continue
    }
    logger.warn(
      `Translation missing for segment ${id} after coordinator loop, falling back to original`,
    )
    translations.set(id, sources[id])
  }

  if (metrics) {
    const state = created.state.translation
    metrics.writerMs =
      state.firstWriteAt === null ? 0 : state.firstWriteAt - loopStart
    if (!reviewerRuntime) {
      metrics.reviewer = emptyReviewerMetrics('review-disabled')
      metrics.editor = emptyEditorMetrics('review-disabled')
    } else if (state.reviewerFailed) {
      metrics.reviewer = {
        ...emptyReviewerMetrics('reviewer-failed'),
        invoked: true,
        durationMs: state.reviewerMs,
        rounds: state.reviewRounds,
      }
      metrics.editor = emptyEditorMetrics('editor-skipped')
    } else if (state.reviewRounds === 0) {
      metrics.reviewer = emptyReviewerMetrics('model-skipped-review')
      metrics.editor = emptyEditorMetrics('editor-skipped')
    } else {
      metrics.reviewer = {
        ...buildReviewerMetrics(state.reviewerMs, {
          issues: state.lastIssues,
        }),
        rounds: state.reviewRounds,
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
              state.lastIssues.length === 0 ? 'empty-issues' : 'editor-skipped',
            )
    }
  }

  return {
    sourceLang: created.state.translation.sourceLang ?? '',
    translations,
  }
}
