import { Loader2 } from 'lucide-react'
import type { AITask } from '~/api/ai'

import { AITaskStatus } from '~/api/ai'
import { useI18n } from '~/i18n'
import { cn } from '~/utils/cn'

import { formatAbsoluteTimestamp, getEffectiveStatus } from '../utils/ai'

interface Stage {
  key: 'created' | 'started' | 'running' | 'completed'
  labelKey:
    | 'ai.tasks.timeline.completed'
    | 'ai.tasks.timeline.created'
    | 'ai.tasks.timeline.running'
    | 'ai.tasks.timeline.started'
  timestamp?: number
  state: 'done' | 'active' | 'pending'
  duration?: string
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const remS = s % 60
  if (m < 60) return remS ? `${m}m${remS}s` : `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h${m % 60}m`
}

function relativeDuration(from?: number, to?: number) {
  if (!from || !to) return undefined
  const diff = to - from
  if (diff <= 0) return undefined
  return `+${formatDuration(diff)}`
}

export function TaskTimeline(props: { task: AITask }) {
  const { t } = useI18n()
  const task = props.task
  const effective = getEffectiveStatus(task)
  const now = Date.now()

  const isFinal =
    task.status === AITaskStatus.Completed ||
    task.status === AITaskStatus.Failed ||
    task.status === AITaskStatus.PartialFailed ||
    task.status === AITaskStatus.Cancelled

  const running =
    effective === AITaskStatus.Running && task.startedAt && !isFinal

  const stages: Stage[] = [
    {
      key: 'created',
      labelKey: 'ai.tasks.timeline.created',
      timestamp: task.createdAt,
      state: 'done',
    },
    {
      key: 'started',
      labelKey: 'ai.tasks.timeline.started',
      timestamp: task.startedAt,
      state: task.startedAt ? 'done' : 'pending',
      duration: relativeDuration(task.createdAt, task.startedAt),
    },
  ]

  if (running) {
    stages.push({
      key: 'running',
      labelKey: 'ai.tasks.timeline.running',
      timestamp: undefined,
      state: 'active',
      duration: relativeDuration(task.startedAt, now),
    })
  }

  stages.push({
    key: 'completed',
    labelKey: 'ai.tasks.timeline.completed',
    timestamp: task.completedAt,
    state: task.completedAt ? 'done' : 'pending',
    duration: relativeDuration(
      task.startedAt ?? task.createdAt,
      task.completedAt,
    ),
  })

  return (
    <section className="mb-6">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {t('ai.tasks.timeline.title')}
      </h3>
      <ol className="space-y-2">
        {stages.map((stage, index) => (
          <li className="flex items-start gap-3 text-sm" key={stage.key}>
            <div className="relative mt-1 flex flex-col items-center">
              <StageMarker state={stage.state} />
              {index < stages.length - 1 ? (
                <span className="absolute top-3 h-full w-px bg-neutral-200 dark:bg-neutral-800" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1 pb-2">
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={cn(
                    'font-medium',
                    stage.state === 'pending'
                      ? 'text-neutral-400 dark:text-neutral-500'
                      : 'text-neutral-950 dark:text-neutral-50',
                  )}
                >
                  {t(stage.labelKey)}
                </span>
                {stage.duration ? (
                  <span className="shrink-0 text-xs tabular-nums text-neutral-400 dark:text-neutral-500">
                    {stage.duration}
                  </span>
                ) : null}
              </div>
              <div className="mt-0.5 text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                {stage.timestamp
                  ? formatAbsoluteTimestamp(stage.timestamp)
                  : t('ai.tasks.timeline.notReached')}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function StageMarker(props: { state: Stage['state'] }) {
  if (props.state === 'active') {
    return (
      <Loader2
        aria-hidden="true"
        className="size-3 animate-spin text-blue-500"
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'size-2.5 rounded-full border',
        props.state === 'done'
          ? 'border-emerald-500 bg-emerald-500'
          : 'border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900',
      )}
    />
  )
}
