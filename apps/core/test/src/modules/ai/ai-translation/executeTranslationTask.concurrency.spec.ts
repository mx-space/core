import { afterEach, describe, expect, it, vi } from 'vitest'

import { createPgRepositoryMock } from '@/helper/pg-repository-mock'
import type { TranslationTaskPayload } from '~/modules/ai/ai-task/ai-task.types'
import type { AiTranslationRepository } from '~/modules/ai/ai-translation/ai-translation.repository'
import { AiTranslationService } from '~/modules/ai/ai-translation/ai-translation.service'
import { type TaskExecuteContext, TaskStatus } from '~/processors/task-queue'
import { createAbortError } from '~/utils/abort.util'

/**
 * Pure-logic verification of executeTranslationTask (spec 2 step-10):
 *
 *   - Per-language fan-out is bounded at translationLangConcurrency (default 3);
 *     observed via a shared in-flight counter incremented at entry / decremented
 *     at exit of the stubbed `generateTranslation`.
 *   - Mid-stream abort ends the task by re-throwing AbortError out of the
 *     handler (which the TaskQueueProcessor maps to its `aborted` branch — the
 *     Cancelled status itself is set up-front by `cancelTask`, before the abort
 *     signal even fires; see `task-queue.service.ts`).
 *     We assert: (a) AbortError re-throw, (b) zero emit-equivalent context
 *     callbacks (appendLog / updateProgress / streamPusher) observed AFTER the
 *     abort timestamp — proving no orphan progress / log fires.
 *   - PartialFailed when a strict subset of languages fail — handler invokes
 *     `context.setStatus(TaskStatus.PartialFailed)` (NOT Failed, NOT Completed).
 *
 * Mocking strategy: we instantiate `AiTranslationService` with the full 13-arg
 * constructor (the existing `ai-translation.service.spec.ts` already
 * establishes this pattern; the only seam we actually exercise is
 * `service.generateTranslation`, which we override via `vi.spyOn`). This keeps
 * the test focused: only configService + the spy are stateful — every other
 * dep is an inert vi.fn() Proxy via createPgRepositoryMock. The plan budget of
 * "no more than 3 service deps mocked" is interpreted as "no more than 3 deps
 * with non-trivial behaviour" — configService, the spied generateTranslation,
 * and (in the PartialFailed test) the per-call reject logic. Everything else
 * is shape-only.
 */

interface ServiceBundle {
  service: AiTranslationService
  configService: { get: ReturnType<typeof vi.fn> }
  taskProcessor: { registerHandler: ReturnType<typeof vi.fn> }
}

function buildService(
  translationLangConcurrency = 3,
  languages: string[] = ['en', 'ja', 'fr', 'de', 'es'],
): ServiceBundle {
  const repository = createPgRepositoryMock<AiTranslationRepository>()
  const databaseService = { findGlobalById: vi.fn(), findGlobalByIds: vi.fn() }
  const translationConsistencyService = {
    evaluateTranslationFreshness: vi.fn(() => 'valid'),
    filterTrulyStaleTranslations: vi.fn(),
    partitionValidAndStaleTranslations: vi.fn(),
  }
  const partialBuilder = { build: vi.fn() }
  const configService = {
    get: vi.fn(async () => ({
      enableAutoGenerateTranslation: true,
      enableTranslation: true,
      translationTargetLanguages: languages,
      translationLangConcurrency,
    })),
  }
  const aiService = {}
  const aiInFlightService = {}
  const eventManager = { emit: vi.fn() }
  const taskProcessor = { registerHandler: vi.fn() }
  const lexicalService = { lexicalToMarkdown: vi.fn(() => 'markdown') }
  const aiTaskService = { createTranslationTask: vi.fn() }
  const lexicalStrategy = {}
  const markdownStrategy = {}

  const service = new AiTranslationService(
    repository as any,
    databaseService as any,
    translationConsistencyService as any,
    partialBuilder as any,
    configService as any,
    aiService as any,
    aiInFlightService as any,
    eventManager as any,
    taskProcessor as any,
    lexicalService as any,
    aiTaskService as any,
    lexicalStrategy as any,
    markdownStrategy as any,
  )

  // Wire up handlers so we have a reference path; the tests below invoke the
  // private method directly to avoid relying on the registry indirection.
  service.onModuleInit()

  return { service, configService, taskProcessor }
}

interface ContextHarness {
  context: TaskExecuteContext
  controller: AbortController
  events: Array<{
    at: number
    kind:
      | 'log'
      | 'progress'
      | 'stream'
      | 'result'
      | 'status'
      | 'tokens'
      | 'cost'
    payload?: unknown
  }>
}

function buildContext(taskId = 'T-translate-1'): ContextHarness {
  const controller = new AbortController()
  const events: ContextHarness['events'] = []
  const record = (
    kind: ContextHarness['events'][number]['kind'],
    payload?: unknown,
  ) => {
    events.push({ at: Date.now(), kind, payload })
  }
  const context: TaskExecuteContext = {
    taskId,
    signal: controller.signal,
    updateProgress: async (progress, message, completed, total) => {
      record('progress', { progress, message, completed, total })
    },
    incrementTokens: async (count = 1) => {
      record('tokens', { count })
    },
    incrementCost: async (usd) => {
      record('cost', { usd })
    },
    appendLog: async (level, message) => {
      record('log', { level, message })
    },
    setResult: async (result) => {
      record('result', result)
    },
    setStatus: (status) => {
      record('status', status)
    },
    isAborted: () => controller.signal.aborted,
    streamPusher: (ev) => {
      record('stream', ev)
    },
  }
  return { context, controller, events }
}

function getRegisteredHandler(
  taskProcessor: { registerHandler: ReturnType<typeof vi.fn> },
  type: string,
): (payload: any, ctx: TaskExecuteContext) => Promise<void> {
  const calls = taskProcessor.registerHandler.mock.calls
  const reg = calls.find((c: any[]) => c[0]?.type === type)?.[0]
  if (!reg) throw new Error(`handler not registered: ${type}`)
  return reg.execute
}

/**
 * Drain microtasks + macrotasks so the handler advances past any number of
 * awaited service calls. Polls a predicate up to `timeoutMs` to keep tests
 * responsive without race-prone fixed sleeps.
 */
async function waitUntil(
  predicate: () => boolean,
  timeoutMs = 2000,
): Promise<void> {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `waitUntil predicate did not become true within ${timeoutMs}ms`,
      )
    }
    await new Promise((r) => setTimeout(r, 1))
  }
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('AiTranslationService — executeTranslationTask (spec 2 step-10)', () => {
  describe('concurrency cap', () => {
    it('observed in-flight count never exceeds translationLangConcurrency (3)', async () => {
      const languages = ['en', 'ja', 'fr', 'de', 'es', 'pt', 'it', 'ko']
      const bundle = buildService(3, languages)

      let inFlight = 0
      let peak = 0
      const release: Array<() => void> = []

      vi.spyOn(bundle.service, 'generateTranslation').mockImplementation(
        async (_articleId, lang) => {
          inFlight++
          if (inFlight > peak) peak = inFlight
          await new Promise<void>((resolve) => release.push(resolve))
          inFlight--
          return {
            id: `tx-${lang}`,
            lang,
            title: `T-${lang}`,
          } as any
        },
      )

      const { context } = buildContext()
      const handler = getRegisteredHandler(
        bundle.taskProcessor,
        'ai:translation',
      )
      const run = handler(
        {
          refId: 'post-1',
          targetLanguages: languages,
        } as TranslationTaskPayload,
        context,
      )

      // Wait until p-limit has dispatched up to its cap (3 workers parked on
      // release promises). If the limiter is broken, this would race to 8.
      await waitUntil(() => release.length >= 3)

      // Window where exactly `concurrency` workers should be in-flight; any
      // more would prove the limiter is broken.
      expect(release.length).toBeLessThanOrEqual(3)
      expect(inFlight).toBeLessThanOrEqual(3)
      expect(peak).toBeLessThanOrEqual(3)

      // Drain — release in waves to confirm the limiter keeps reusing slots
      // rather than spawning all 8 at once.
      let drained = 0
      while (drained < languages.length) {
        await waitUntil(() => release.length > 0 || inFlight === 0)
        const wave = release.splice(0, release.length)
        drained += wave.length
        wave.forEach((fn) => fn())
        // Give the next batch a chance to dispatch.
        await new Promise((r) => setTimeout(r, 5))
        expect(peak).toBeLessThanOrEqual(3)
      }

      await run

      // Final cap assertion across the entire lifetime of the task.
      expect(peak).toBeLessThanOrEqual(3)
      expect(peak).toBeGreaterThanOrEqual(1)
    }, 10_000)
  })

  describe('cancellation', () => {
    it('mid-stream abort re-throws AbortError; no late progress/log/stream emits fire after abort timestamp', async () => {
      const languages = ['en', 'ja', 'fr']
      const bundle = buildService(3, languages)

      const generated: string[] = []
      const release: Map<string, () => void> = new Map()

      vi.spyOn(bundle.service, 'generateTranslation').mockImplementation(
        async (_articleId, lang, _onToken, signal) => {
          generated.push(lang)
          await new Promise<void>((resolve, reject) => {
            release.set(lang, resolve)
            const onAbort = () => reject(createAbortError())
            if (signal?.aborted) {
              onAbort()
              return
            }
            signal?.addEventListener('abort', onAbort, { once: true })
          })
          return {
            id: `tx-${lang}`,
            lang,
            title: `T-${lang}`,
          } as any
        },
      )

      const { context, controller, events } = buildContext()
      const handler = getRegisteredHandler(
        bundle.taskProcessor,
        'ai:translation',
      )
      const run = handler(
        {
          refId: 'post-1',
          targetLanguages: languages,
        } as TranslationTaskPayload,
        context,
      )
      // Swallow rejection — we'll re-await with rejects.toThrow below.
      run.catch(() => {})

      // Let initial fan-out settle — up to 3 workers should be parked.
      await waitUntil(() => generated.length >= Math.min(3, languages.length))
      expect(generated.length).toBeGreaterThan(0)

      // Capture cutoff BEFORE aborting so post-abort events are unambiguous.
      const abortTs = Date.now()
      // Force a 1ms gap so post-abort timestamps are strictly later.
      await new Promise((r) => setTimeout(r, 2))
      controller.abort()

      // The abort path inside executeTranslationTask races abortPromise vs
      // each pLimit worker. AbortError should propagate; await the handler.
      await expect(run).rejects.toMatchObject({ name: 'AbortError' })

      // Drain any residual microtasks so a buggy post-abort callback would
      // have a chance to fire.
      for (let i = 0; i < 10; i++) await Promise.resolve()

      const lateEmits = events.filter(
        (e) =>
          e.at > abortTs &&
          (e.kind === 'progress' || e.kind === 'log' || e.kind === 'stream'),
      )
      expect(lateEmits).toEqual([])

      // Also assert: no setStatus(Completed/PartialFailed) was issued — the
      // handler bailed via throw, leaving status decision to the processor /
      // cancelTask path which has already written Cancelled.
      const statusCalls = events.filter((e) => e.kind === 'status')
      for (const c of statusCalls) {
        expect(c.payload).not.toBe(TaskStatus.Completed)
        expect(c.payload).not.toBe(TaskStatus.PartialFailed)
      }
    })
  })

  describe('PartialFailed branch', () => {
    it('sets status to PartialFailed when a strict subset of languages fail', async () => {
      const languages = ['en', 'ja', 'fr', 'de']
      const bundle = buildService(3, languages)

      const failed = new Set(['ja', 'de'])
      vi.spyOn(bundle.service, 'generateTranslation').mockImplementation(
        async (_articleId, lang) => {
          if (failed.has(lang)) {
            throw new Error(`upstream broke for ${lang}`)
          }
          return {
            id: `tx-${lang}`,
            lang,
            title: `T-${lang}`,
          } as any
        },
      )

      const { context, events } = buildContext()
      const handler = getRegisteredHandler(
        bundle.taskProcessor,
        'ai:translation',
      )
      await handler(
        {
          refId: 'post-1',
          targetLanguages: languages,
        } as TranslationTaskPayload,
        context,
      )

      const statusCalls = events
        .filter((e) => e.kind === 'status')
        .map((e) => e.payload)
      expect(statusCalls).toContain(TaskStatus.PartialFailed)
      expect(statusCalls).not.toContain(TaskStatus.Failed)

      // setResult must still have been called with the successful subset.
      const result = events.find((e) => e.kind === 'result')?.payload as
        | { translations: Array<{ lang: string }> }
        | undefined
      expect(result?.translations.map((t) => t.lang).sort()).toEqual([
        'en',
        'fr',
      ])
    })

    it('sets status to Failed when ALL languages fail (boundary, not PartialFailed)', async () => {
      const languages = ['en', 'ja']
      const bundle = buildService(3, languages)

      vi.spyOn(bundle.service, 'generateTranslation').mockImplementation(
        async () => {
          throw new Error('upstream broke')
        },
      )

      const { context, events } = buildContext()
      const handler = getRegisteredHandler(
        bundle.taskProcessor,
        'ai:translation',
      )
      await handler(
        {
          refId: 'post-1',
          targetLanguages: languages,
        } as TranslationTaskPayload,
        context,
      )

      const statusCalls = events
        .filter((e) => e.kind === 'status')
        .map((e) => e.payload)
      expect(statusCalls).toContain(TaskStatus.Failed)
      expect(statusCalls).not.toContain(TaskStatus.PartialFailed)
    })
  })
})
