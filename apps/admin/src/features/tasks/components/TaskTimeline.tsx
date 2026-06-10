import { Loader2 } from 'lucide-react'

import type { AITask } from '~/api/tasks'
import { AITaskStatus } from '~/api/tasks'
import { useI18n } from '~/i18n'
import { cn } from '~/utils/cn'

import { formatAbsoluteTimestamp, getEffectiveStatus } from '../utils/tasks'

interface Stage {
  key: 'created' | 'started' | 'running' | 'completed'
  labelKey:
    | 'tasks.timeline.completed'
    | 'tasks.timeline.created'
    | 'tasks.timeline.running'
    | 'tasks.timeline.started'
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
      labelKey: 'tasks.timeline.created',
      timestamp: task.createdAt,
      state: 'done',
    },
    {
      key: 'started',
      labelKey: 'tasks.timeline.started',
      timestamp: task.startedAt,
      state: task.startedAt ? 'done' : 'pending',
      duration: relativeDuration(task.createdAt, task.startedAt),
    },
  ]

  if (running) {
    stages.push({
      key: 'running',
      labelKey: 'tasks.timeline.running',
      timestamp: undefined,
      state: 'active',
      duration: relativeDuration(task.startedAt, now),
    })
  }

  stages.push({
    key: 'completed',
    labelKey: 'tasks.timeline.completed',
    timestamp: task.completedAt,
    state: task.completedAt ? 'done' : 'pending',
    duration: relativeDuration(
      task.startedAt ?? task.createdAt,
      task.completedAt,
    ),
  })

  return (
    <section className="mb-6">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-fg-muted">
        {t('tasks.timeline.title')}
      </h3>
      <ol>
        {stages.map((stage, index) => (
          <li className="flex items-stretch gap-3 text-sm" key={stage.key}>
            <div className="flex flex-col items-center pt-1">
              <StageMarker state={stage.state} />
              {index < stages.length - 1 ? (
                <span className="mt-1 w-px flex-1 bg-border" />
              ) : null}
            </div>
            <div
              className={cn(
                'min-w-0 flex-1',
                index < stages.length - 1 && 'pb-3',
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={cn(
                    'font-medium',
                    stage.state === 'pending' ? 'text-fg-subtle' : 'text-fg',
                  )}
                >
                  {t(stage.labelKey)}
                </span>
                {stage.duration ? (
                  <span className="shrink-0 text-xs tabular-nums text-fg-subtle">
                    {stage.duration}
                  </span>
                ) : null}
              </div>
              <div className="mt-0.5 text-xs tabular-nums text-fg-muted">
                {stage.timestamp
                  ? formatAbsoluteTimestamp(stage.timestamp)
                  : t('tasks.timeline.notReached')}
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
          : 'border-border-strong bg-surface-card',
      )}
    />
  )
}
