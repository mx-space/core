import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  X,
  XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'

import type { PublishAiResource, PublishTask } from '~/api/publish-jobs'
import {
  AITaskStatus,
  cancelTask,
  getTask,
  getTasks,
  retryTask,
} from '~/api/tasks'
import { CAPABILITY_META } from '~/features/ai/components/article-overview/capability-meta'
import {
  fallbackPollingIntervalMs,
  liveSubscribeIntervalMs,
  statusIcon,
} from '~/features/tasks/constants'
import {
  useTaskDetailSubscription,
  useTaskListSubscription,
} from '~/features/tasks/hooks/useTaskSubscription'
import {
  getProgress,
  getTaskProgressLabel,
  statusIconClassName,
} from '~/features/tasks/utils/tasks'
import { useLocalStorageState } from '~/hooks/use-local-storage-state'
import { useI18n } from '~/i18n'
import type { TranslationKey } from '~/i18n/types'
import { adminQueryKeys } from '~/query/keys'
import { confirmDialog } from '~/ui/feedback/confirm'
import { Popover } from '~/ui/overlay/popover'
import { Button } from '~/ui/primitives/button'
import { cn } from '~/utils/cn'

type PublishProcessPhase =
  | 'cancelled'
  | 'completed'
  | 'failed'
  | 'partial'
  | 'preparing'
  | 'publishing'
  | 'queued'

const phaseLabelKeys: Record<PublishProcessPhase, TranslationKey> = {
  cancelled: 'write.publishProcess.cancelled',
  completed: 'write.publishProcess.completed',
  failed: 'write.publishProcess.failed',
  partial: 'write.publishProcess.onlineUpdatedWithAiFailure',
  preparing: 'write.publishProcess.preparing',
  publishing: 'write.publishProcess.publishing',
  queued: 'write.publishProcess.queued',
}

const queryParams = {
  page: 1,
  scope: 'content' as const,
  size: 20,
  type: 'content:publish',
}
const DISMISSED_PUBLISH_TASKS_KEY = 'dismissed-publish-task-ids'

export function openPublishProcessDock() {
  window.dispatchEvent(new Event('mx-admin:open-publish-dock'))
}

export function PublishProcessDock() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [dismissedIds, setDismissedIds] = useLocalStorageState<string[]>(
    DISMISSED_PUBLISH_TASKS_KEY,
    [],
  )
  const dismissed = useMemo(() => new Set(dismissedIds), [dismissedIds])
  const { socketConnected } = useTaskListSubscription()
  const tasksQuery = useQuery({
    queryFn: () => getTasks<PublishTask>(queryParams),
    queryKey: adminQueryKeys.tasks.tasks(queryParams),
    refetchInterval: () =>
      socketConnected ? liveSubscribeIntervalMs : fallbackPollingIntervalMs,
  })

  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener('mx-admin:open-publish-dock', show)
    return () => window.removeEventListener('mx-admin:open-publish-dock', show)
  }, [])

  const tasks = (tasksQuery.data?.data ?? []).filter(
    (task) => !dismissed.has(task.id),
  )
  if (!tasks.length) return null

  const current = tasks.find(isActiveTask) ?? tasks[0]
  const phase = getPhase(current)
  const progress = getPublishProgress(current)
  const CurrentIcon = getPhaseIcon(phase)

  return (
    <div className="fixed right-4 bottom-4 z-[1090] max-sm:left-4">
      <Popover onOpenChange={setOpen} open={open}>
        <Popover.Trigger
          aria-label={t('write.publishProcess.open')}
          className={cn(
            'flex h-10 max-w-[min(24rem,calc(100vw-2rem))] items-center gap-2 rounded-lg border border-border bg-surface-overlay px-3 text-sm shadow-lg hover:bg-surface-card focus-visible:ring-[3px] focus-visible:ring-accent/20',
            phase === 'failed' && 'border-red-500/40',
            phase === 'partial' && 'border-amber-500/40',
          )}
        >
          <CurrentIcon
            aria-hidden="true"
            className={cn(
              'size-4 shrink-0',
              isActiveTask(current) && 'animate-spin text-accent',
              phase === 'completed' && 'text-emerald-500',
              phase === 'failed' && 'text-red-500',
              phase === 'partial' && 'text-amber-500',
            )}
          />
          <span aria-live="polite" className="min-w-0 truncate">
            {t(getPhaseLabelKey(current, phase))}
          </span>
          {isActiveTask(current) ? (
            <span className="text-xs text-fg-muted tabular-nums">
              {progress}%
            </span>
          ) : null}
          {tasks.length > 1 ? (
            <span className="rounded-full bg-surface-inset px-1.5 text-xs text-fg-muted tabular-nums">
              {tasks.length}
            </span>
          ) : null}
        </Popover.Trigger>
        <Popover.Content
          align="end"
          className="max-h-[min(72svh,38rem)] overflow-hidden"
          side="top"
          sideOffset={8}
          width="lg"
        >
          <Popover.Header>{t('write.publishProcess.title')}</Popover.Header>
          <Popover.Body className="max-h-[min(64svh,34rem)] overflow-y-auto p-0">
            {tasks.map((task) => (
              <ProcessDetail
                key={task.id}
                onDismiss={() =>
                  setDismissedIds([...new Set([...dismissedIds, task.id])])
                }
                task={task}
              />
            ))}
          </Popover.Body>
        </Popover.Content>
      </Popover>
    </div>
  )
}

function ProcessDetail(props: { onDismiss: () => void; task: PublishTask }) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const { task } = props
  const phase = getPhase(task)
  const active = isActiveTask(task)
  const progress = getPublishProgress(task)
  const articleId = task.result?.articleId ?? task.payload.refId
  const editPath = articleId
    ? `/${task.payload.refType === 'post' ? 'posts' : task.payload.refType === 'note' ? 'notes' : 'pages'}/edit?id=${encodeURIComponent(articleId)}`
    : null

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: adminQueryKeys.tasks.tasksRoot })
  const terminate = async () => {
    const confirmed = await confirmDialog({
      confirmText: t('write.publishProcess.terminate'),
      description: t('write.publishProcess.terminateDescription'),
      destructive: true,
      title: t('write.publishProcess.terminateTitle'),
    })
    if (!confirmed) return
    await cancelTask(task.id)
    await refresh()
  }
  const retry = async () => {
    if (
      task.result?.newerDraftChanges &&
      !(await confirmDialog({
        confirmText: t('common.retry'),
        description: t('write.publishProcess.retryOlderDescription'),
        title: t('write.publishProcess.retryOlderTitle'),
      }))
    ) {
      return
    }
    await retryTask(task.id)
    await refresh()
  }

  const title =
    task.payload.snapshot.title || t(`write.kind.${task.payload.refType}`)
  return (
    <section className="border-b border-border p-3 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {editPath ? (
            <Link
              className="block truncate font-medium hover:text-accent hover:underline"
              to={editPath}
            >
              {title}
            </Link>
          ) : (
            <span className="block truncate font-medium">{title}</span>
          )}
          <p className="mt-0.5 text-xs text-fg-muted">
            {t(getPhaseLabelKey(task, phase))}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {active && !task.result?.articleCommitted ? (
            <Button
              className="h-7 px-2 text-xs text-red-600 hover:bg-red-500/10 dark:text-red-400"
              onClick={() => void terminate()}
              variant="ghost"
            >
              {t('write.publishProcess.terminate')}
            </Button>
          ) : phase === 'failed' ||
            phase === 'cancelled' ||
            phase === 'partial' ? (
            <Button
              className="h-7 px-2 text-xs"
              onClick={() => void retry()}
              variant="ghost"
            >
              {t('common.retry')}
            </Button>
          ) : null}
          {!active ? (
            <Button
              aria-label={t('common.close')}
              className="size-7"
              iconOnly
              onClick={props.onDismiss}
              variant="ghost"
            >
              <X aria-hidden="true" className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
          <div
            className={cn(
              'h-full rounded-full bg-accent transition-[width] duration-300',
              phase === 'failed' && 'bg-red-500',
              phase === 'partial' && 'bg-amber-500',
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="w-9 text-right text-xs text-fg-muted tabular-nums">
          {progress}%
        </span>
      </div>

      {task.payload.aiResources.length ? (
        <ul className="mt-2 flex flex-col gap-px">
          {task.payload.aiResources.map((resource) => (
            <ResourceProgress
              key={resource}
              resource={resource}
              taskId={task.result?.resources[resource]}
            />
          ))}
        </ul>
      ) : null}
      {active ? (
        <p className="mt-2 text-xs leading-5 text-fg-muted">
          {t('write.publishProcess.snapshotNotice')}
        </p>
      ) : null}
      {task.error ? (
        <p className="mt-2 text-xs break-words text-red-600 dark:text-red-400">
          {task.error}
        </p>
      ) : null}
      {task.result?.newerDraftChanges ? (
        <div className="mt-2 rounded-md border border-amber-500/25 bg-amber-500/8 px-2.5 py-2 text-xs leading-5 text-amber-800 dark:text-amber-300">
          {t(
            phase === 'completed' || phase === 'partial'
              ? 'write.publishProcess.newerDraftRemains'
              : 'write.publishProcess.retryUsesOlderSnapshot',
          )}
          {editPath ? (
            <Link className="ml-1 font-medium underline" to={editPath}>
              {t('write.publishProcess.openLatestDraft')}
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function ResourceProgress(props: {
  resource: PublishAiResource
  taskId?: string
}) {
  const { t } = useI18n()
  const { socketConnected } = useTaskDetailSubscription(props.taskId)
  const taskQuery = useQuery({
    enabled: Boolean(props.taskId),
    queryFn: () => getTask(props.taskId!),
    queryKey: adminQueryKeys.tasks.taskDetail(props.taskId ?? ''),
    refetchInterval: () =>
      socketConnected ? liveSubscribeIntervalMs : fallbackPollingIntervalMs,
  })
  const task = taskQuery.data
  const status = task?.status ?? AITaskStatus.Pending
  const meta = CAPABILITY_META[props.resource]
  const CapabilityIcon = meta.icon
  const StatusIcon = statusIcon[status] ?? Clock
  const progress = task ? Math.round(getProgress(task) ?? 0) : 0

  return (
    <li className="group flex h-8 items-center gap-2 rounded-sm px-2.5 text-xs hover:bg-surface-inset">
      <CapabilityIcon
        aria-hidden="true"
        className="size-4 shrink-0 text-fg-subtle"
      />
      <span className="min-w-0 flex-1 truncate">{t(meta.labelKey)}</span>
      {props.taskId ? (
        <Link
          aria-label={t('write.publishProcess.viewTask')}
          className="inline-flex size-6 items-center justify-center text-fg-subtle hover:text-fg"
          to={`/tasks/${encodeURIComponent(props.taskId)}`}
        >
          <ExternalLink aria-hidden="true" className="size-3.5" />
        </Link>
      ) : null}
      <span className="inline-flex items-center gap-1.5 text-fg-muted tabular-nums">
        <StatusIcon
          aria-hidden="true"
          className={cn('size-3.5', statusIconClassName(status))}
        />
        {task
          ? (getTaskProgressLabel(task) ?? `${progress}%`)
          : t('write.publishProcess.queued')}
      </span>
    </li>
  )
}

function isActiveTask(task: PublishTask) {
  return (
    task.status === AITaskStatus.Pending || task.status === AITaskStatus.Running
  )
}

function getPublishProgress(task: PublishTask) {
  return Math.round(task.progress ?? 0)
}

function getPhase(task: PublishTask): PublishProcessPhase {
  if (task.status === AITaskStatus.Completed) return 'completed'
  if (task.status === AITaskStatus.Cancelled) {
    return task.result?.articleCommitted ? 'partial' : 'cancelled'
  }
  if (
    task.status === AITaskStatus.Failed ||
    task.status === AITaskStatus.PartialFailed
  )
    return task.result?.articleCommitted ? 'partial' : 'failed'
  if (task.status === AITaskStatus.Pending) return 'queued'
  return (task.progress ?? 0) >= 95 ? 'publishing' : 'preparing'
}

function getPhaseLabelKey(
  task: PublishTask,
  phase: PublishProcessPhase,
): TranslationKey {
  if (phase !== 'completed') return phaseLabelKeys[phase]
  if (task.payload.operation === 'online-update') {
    return 'write.publishProcess.onlineUpdated'
  }
  if (task.payload.operation === 'republish') {
    return 'write.publishProcess.republished'
  }
  return 'write.publishProcess.firstPublished'
}

function getPhaseIcon(phase: PublishProcessPhase) {
  if (phase === 'completed') return CheckCircle2
  if (phase === 'failed') return AlertCircle
  if (phase === 'partial') return AlertCircle
  if (phase === 'cancelled') return XCircle
  return Loader2
}
