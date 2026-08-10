import { AlertTriangle, RotateCw } from 'lucide-react'
import { Link } from 'react-router'

import type { ActiveGeneration } from '~/api/ai-overview'
import { useI18n } from '~/i18n'

import { CAPABILITY_META } from './capability-meta'
import { isTaskLive } from './coverage-cells'

export function ActiveTaskList(props: {
  tasks: ActiveGeneration[]
  onRetry: (task: ActiveGeneration) => void
}) {
  const { t } = useI18n()

  if (!props.tasks.length) return null

  return (
    <ul className="flex flex-col gap-2.5 border-t border-border/60 pt-3">
      {props.tasks.map((task) => {
        const meta = CAPABILITY_META[task.capability]
        const Icon = meta.icon
        const live = isTaskLive(task)
        return (
          <li key={task.taskId}>
            <div className="flex items-center gap-2 text-xs">
              <Icon aria-hidden="true" className="size-3.5 text-fg-subtle" />
              <span className="text-fg">{t(meta.labelKey)}</span>
              <span className="text-fg-subtle">
                {task.langs.length
                  ? task.langs.join(', ')
                  : t('ai.overview.progress.allLangs')}
              </span>
              {live ? (
                <span className="ml-auto tabular-nums text-fg-muted">
                  {task.progress != null
                    ? `${Math.round(task.progress)}%`
                    : task.totalItems != null
                      ? `${task.completedItems ?? 0} / ${task.totalItems}`
                      : t(
                          task.status === 'running'
                            ? 'ai.overview.progress.running'
                            : 'ai.overview.progress.queued',
                        )}
                </span>
              ) : (
                <button
                  className="ml-auto inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-fg-muted transition-colors hover:bg-surface-inset hover:text-fg focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15"
                  onClick={() => props.onRetry(task)}
                  type="button"
                >
                  <RotateCw aria-hidden="true" className="size-3" />
                  {t('ai.overview.progress.retry')}
                </button>
              )}
              <Link
                className="text-fg-subtle underline-offset-2 hover:text-fg hover:underline"
                to={`/tasks/${task.taskId}`}
              >
                {t('ai.overview.progress.detail')}
              </Link>
            </div>

            {live ? (
              <ProgressBar
                completed={task.completedItems}
                total={task.totalItems}
                value={task.progress}
              />
            ) : (
              <p className="mt-1 flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 size-3 shrink-0"
                />
                <span className="min-w-0 break-words">
                  {task.error ?? t('ai.overview.progress.failed')}
                </span>
              </p>
            )}

            {live && task.progressMessage ? (
              <p className="mt-1 truncate text-xs text-fg-subtle">
                {task.progressMessage}
              </p>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Queued tasks report no percentage at all, so the bar pulses rather than
 * claiming 0% — a still bar at zero reads as "stuck", which is the very
 * confusion this list exists to remove.
 */
function ProgressBar(props: {
  value: number | null
  completed: number | null
  total: number | null
}) {
  const ratio =
    props.value != null
      ? props.value / 100
      : props.total
        ? (props.completed ?? 0) / props.total
        : null

  return (
    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-inset">
      {ratio == null ? (
        <div className="h-full w-full animate-pulse rounded-full bg-accent/40" />
      ) : (
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%` }}
        />
      )}
    </div>
  )
}
