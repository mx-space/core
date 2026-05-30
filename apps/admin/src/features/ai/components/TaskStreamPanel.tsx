import { useEffect, useRef, useState } from 'react'

import type { AITask } from '~/api/ai'
import { AITaskStatus, AITaskType } from '~/api/ai'
import { useI18n } from '~/i18n'
import type { AiTaskUpdateStreamFrame } from '~/socket/types'
import { Scroll } from '~/ui/primitives/scroll'

interface LexicalSegment {
  partial: unknown
  receivedAt: number
}

interface LangStreamState {
  chunks: string[]
  done: boolean
  segments: Map<string, LexicalSegment>
  updatedAt: number
}

type StreamsState = Map<string, LangStreamState>

const DEFAULT_LANG_KEY = '__default__'

interface StreamEventDetail {
  groupId?: string
  stream?: AiTaskUpdateStreamFrame
  taskId: string
}

const STREAMABLE_TYPES: ReadonlySet<AITaskType> = new Set([
  AITaskType.Translation,
  AITaskType.TranslationBatch,
  AITaskType.Summary,
  AITaskType.Insights,
])

export function shouldMountTaskStreamPanel(task: AITask): boolean {
  if (task.status !== AITaskStatus.Running) return false
  if (!STREAMABLE_TYPES.has(task.type)) return false
  if (task.type === AITaskType.TranslationBatch) {
    return (task.subTaskStats?.running ?? 0) > 0
  }
  return true
}

export function TaskStreamPanel(props: { taskId: string }) {
  const { t } = useI18n()
  const { taskId } = props
  const [streams, setStreams] = useState<StreamsState>(() => new Map())

  useEffect(() => {
    // Reset on taskId change — prevents cross-task leak when navigating.
    setStreams(new Map())

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<StreamEventDetail>).detail
      if (!detail || detail.taskId !== taskId) return
      const frame = detail.stream
      if (!frame) return

      setStreams((prev) => upsertStream(prev, frame))
    }

    window.addEventListener('mx-admin:ai-task-stream', handler)
    return () => {
      window.removeEventListener('mx-admin:ai-task-stream', handler)
    }
  }, [taskId])

  const entries = Array.from(streams.entries())

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {t('ai.task.stream.title')}
        </h3>
      </div>
      <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
        {t('ai.task.stream.lateHint')}
      </p>

      {entries.length === 0 ? (
        <div className="rounded border border-dashed border-neutral-200 px-3 py-4 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          {t('ai.task.stream.waiting')}
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(([lang, state]) => (
            <LangCard key={lang} lang={lang} state={state} />
          ))}
        </div>
      )}
    </section>
  )
}

function LangCard(props: { lang: string; state: LangStreamState }) {
  const { t } = useI18n()
  const { lang, state } = props
  const segments = Array.from(state.segments.entries())
  const isLexical = segments.length > 0
  const langLabel =
    lang === DEFAULT_LANG_KEY
      ? t('ai.task.stream.title')
      : t('ai.task.stream.lang', { lang })

  return (
    <div className="rounded border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:border-neutral-800 dark:text-neutral-200">
        <span>{langLabel}</span>
        {state.done ? (
          <span className="text-emerald-600 dark:text-emerald-400">●</span>
        ) : (
          <span className="animate-pulse text-blue-500">●</span>
        )}
      </div>
      {isLexical ? (
        <LexicalSegments segments={segments} />
      ) : (
        <MarkdownStream chunks={state.chunks} />
      )}
    </div>
  )
}

function MarkdownStream(props: { chunks: string[] }) {
  const { chunks } = props
  const scrollViewportRef = useRef<HTMLDivElement | null>(null)
  const stickyRef = useRef(true)
  const text = chunks.join('')

  // Track whether the user is at the bottom — freeze auto-scroll when not.
  useEffect(() => {
    const node = scrollViewportRef.current
    if (!node) return
    const handleScroll = () => {
      const distance = node.scrollHeight - node.scrollTop - node.clientHeight
      stickyRef.current = distance < 16
    }
    node.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      node.removeEventListener('scroll', handleScroll)
    }
  }, [])

  useEffect(() => {
    if (!stickyRef.current) return
    const node = scrollViewportRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [text])

  return (
    <Scroll
      className="max-h-72"
      orientation="vertical"
      ref={scrollViewportRef}
      viewportClassName="max-h-72"
    >
      <pre className="whitespace-pre-wrap break-words p-3 font-mono text-xs leading-5 text-neutral-800 dark:text-neutral-200">
        {text}
      </pre>
    </Scroll>
  )
}

function LexicalSegments(props: { segments: Array<[string, LexicalSegment]> }) {
  const { t } = useI18n()
  return (
    <Scroll
      className="max-h-72"
      orientation="vertical"
      viewportClassName="max-h-72"
    >
      <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {props.segments.map(([segmentId, segment]) => (
          <li
            key={segmentId}
            className="space-y-1 p-3 text-xs text-neutral-800 transition-opacity duration-200 dark:text-neutral-200"
          >
            <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {t('ai.task.stream.segment', { segmentId })}
            </div>
            <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5">
              {safeStringify(segment.partial)}
            </pre>
          </li>
        ))}
      </ul>
    </Scroll>
  )
}

function upsertStream(
  prev: StreamsState,
  frame: AiTaskUpdateStreamFrame,
): StreamsState {
  const langKey = frame.lang ?? DEFAULT_LANG_KEY
  const next = new Map(prev)
  const existing = next.get(langKey)
  const base: LangStreamState = existing
    ? {
        chunks: existing.chunks,
        done: existing.done,
        segments: new Map(existing.segments),
        updatedAt: existing.updatedAt,
      }
    : {
        chunks: [],
        done: false,
        segments: new Map(),
        updatedAt: 0,
      }

  if (frame.segmentId) {
    base.segments.set(frame.segmentId, {
      partial: frame.partial,
      receivedAt: Date.now(),
    })
  } else if (typeof frame.chunk === 'string' && frame.chunk.length > 0) {
    base.chunks = [...base.chunks, frame.chunk]
  } else if (frame.partial !== undefined) {
    // Partial without segmentId (e.g. summary/insights structured) — render as
    // a synthetic single-segment update.
    base.segments.set('_partial', {
      partial: frame.partial,
      receivedAt: Date.now(),
    })
  }

  base.done = base.done || Boolean(frame.done)
  base.updatedAt = Date.now()
  next.set(langKey, base)
  return next
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
