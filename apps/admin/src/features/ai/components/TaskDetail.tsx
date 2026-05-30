import { Loader2, RotateCcw, Trash2, XCircle } from 'lucide-react'

import type { AITask } from '~/api/ai'
import { AITaskStatus } from '~/api/ai'
import { useI18n } from '~/i18n'
import { DetailHeader } from '~/ui/layout/detail-header'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import {
  statusIcon,
  taskStatusLabelKeys,
  taskTypeLabelKeys,
} from '../constants'
import {
  formatAbsoluteTimestamp,
  getEffectiveStatus,
  getProgress,
  getTaskDetailSummary,
  isBatchTask,
  statusIconClassName,
} from '../utils/ai'
import { Code, Field, JsonBlock, SmallBadge, StatusBadge } from './AiPrimitives'
import { CollapsibleSection } from './CollapsibleSection'
import { SubTaskStatsView } from './SubTaskStatsView'
import { TaskCostBadge } from './TaskCostBadge'
import { TaskLogsBlock } from './TaskLogsBlock'
import { shouldMountTaskStreamPanel, TaskStreamPanel } from './TaskStreamPanel'
import { TaskTimeline } from './TaskTimeline'

export function TaskDetail(props: {
  canceling: boolean
  deleting: boolean
  onBack: () => void
  onCancel: (task: AITask) => void
  onDelete: (task: AITask) => void
  onRetry: (task: AITask) => void
  retrying: boolean
  task: AITask
  polling: boolean
}) {
  const { t } = useI18n()
  const task = props.task
  const effectiveStatus = getEffectiveStatus(task)
  const Icon = statusIcon[effectiveStatus]
  const canCancel =
    effectiveStatus === AITaskStatus.Pending ||
    effectiveStatus === AITaskStatus.Running
  const canRetry =
    task.status === AITaskStatus.Failed ||
    task.status === AITaskStatus.PartialFailed ||
    task.status === AITaskStatus.Cancelled
  const canDelete =
    task.status === AITaskStatus.Completed ||
    task.status === AITaskStatus.Failed ||
    task.status === AITaskStatus.PartialFailed ||
    task.status === AITaskStatus.Cancelled
  const progress = getProgress(task)
  const isRunning = effectiveStatus === AITaskStatus.Running

  return (
    <div className="flex h-full min-h-0 flex-col">
      <DetailHeader
        actions={
          <>
            {canRetry ? (
              <Button
                aria-label={t('ai.action.retryTask')}
                disabled={props.retrying}
                iconOnly
                onClick={() => props.onRetry(task)}
                title={t('ai.action.retryTask')}
                type="button"
                variant="subtle"
              >
                {props.retrying ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <RotateCcw aria-hidden="true" className="size-4" />
                )}
              </Button>
            ) : null}
            {canCancel ? (
              <Button
                aria-label={t('ai.action.cancel')}
                disabled={props.canceling}
                iconOnly
                onClick={() => props.onCancel(task)}
                title={t('ai.action.cancel')}
                type="button"
                variant="subtle"
              >
                {props.canceling ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <XCircle aria-hidden="true" className="size-4" />
                )}
              </Button>
            ) : null}
            {canDelete ? (
              <Button
                aria-label={t('ai.action.deleteTask')}
                className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-950 dark:text-red-400 dark:hover:bg-red-950/30"
                disabled={props.deleting}
                iconOnly
                onClick={() => props.onDelete(task)}
                title={t('ai.action.deleteTask')}
                type="button"
                variant="subtle"
              >
                {props.deleting ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Trash2 aria-hidden="true" className="size-4" />
                )}
              </Button>
            ) : null}
          </>
        }
        icon={Icon}
        iconClassName={cn(
          isRunning && 'animate-spin',
          statusIconClassName(effectiveStatus),
        )}
        onBack={props.onBack}
        subtitle={getTaskDetailSummary(task, t)}
        title={
          <>
            <span className="truncate">{t(taskTypeLabelKeys[task.type])}</span>
            <StatusBadge status={effectiveStatus}>
              {t(taskStatusLabelKeys[effectiveStatus])}
            </StatusBadge>
            <TaskCostBadge cost={task.cost} />
            {task.retryCount > 0 ? (
              <SmallBadge tone="warning">
                {t('ai.task.retryBadge', { count: task.retryCount })}
              </SmallBadge>
            ) : null}
            {isBatchTask(task) ? (
              <SmallBadge tone="info">{t('ai.task.batch')}</SmallBadge>
            ) : null}
          </>
        }
      />

      <Scroll className="flex-1" innerClassName="px-5 py-4">
        {task.error ? (
          <div
            className="mb-5 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-950 dark:bg-red-950/40 dark:text-red-300"
            role="alert"
          >
            <span className="mr-1 font-medium">{t('ai.task.error')}</span>
            {task.error}
          </div>
        ) : null}

        <TaskTimeline task={task} />

        {shouldMountTaskStreamPanel(task) ? (
          <TaskStreamPanel taskId={task.id} />
        ) : null}

        {progress !== null ? (
          <section className="mb-6">
            <div className="mb-2 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
              <span>
                {task.progressMessage ?? t('ai.task.progressDefault')}
              </span>
              <span className="tabular-nums">{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-900">
              <div
                className="h-full rounded-full bg-[var(--color-primary)] transition-[width]"
                style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
              />
            </div>
            {task.tokensGenerated && task.tokensGenerated > 0 ? (
              <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                <Loader2
                  aria-hidden="true"
                  className={cn(
                    'size-3',
                    isRunning && 'animate-spin text-blue-500',
                  )}
                />
                {t('ai.task.tokensGenerated', { count: task.tokensGenerated })}
              </div>
            ) : null}
          </section>
        ) : null}

        <TaskLogsBlock logs={task.logs} polling={props.polling && isRunning} />

        {task.subTaskStats ? (
          <CollapsibleSection
            defaultOpen={isRunning}
            hint={
              <span className="tabular-nums">
                {task.subTaskStats.completed + task.subTaskStats.failed}/
                {task.subTaskStats.total}
              </span>
            }
            title={t('ai.tasks.sections.subTasks')}
          >
            <SubTaskStatsView task={task} />
          </CollapsibleSection>
        ) : null}

        <CollapsibleSection title={t('ai.tasks.sections.payload')}>
          <JsonBlock value={task.payload} />
        </CollapsibleSection>

        {task.result !== undefined ? (
          <CollapsibleSection title={t('ai.tasks.sections.result')}>
            <JsonBlock value={task.result} />
          </CollapsibleSection>
        ) : null}

        <CollapsibleSection title={t('ai.tasks.sections.metadata')}>
          <div className="space-y-5 text-sm">
            <MetadataGroup title={t('ai.tasks.metadata.identity')}>
              <Field label={t('ai.task.id')}>
                <Code>{task.id}</Code>
              </Field>
              <Field label={t('ai.task.type')}>
                {t(taskTypeLabelKeys[task.type])}
              </Field>
              <Field label={t('ai.task.worker')}>{task.workerId ?? '-'}</Field>
            </MetadataGroup>
            <MetadataGroup title={t('ai.tasks.metadata.timestamps')}>
              <Field label={t('ai.task.createdAt')}>
                {formatAbsoluteTimestamp(task.createdAt)}
              </Field>
              <Field label={t('ai.task.startedAt')}>
                {formatAbsoluteTimestamp(task.startedAt)}
              </Field>
              <Field label={t('ai.task.completedAt')}>
                {formatAbsoluteTimestamp(task.completedAt)}
              </Field>
            </MetadataGroup>
            <MetadataGroup title={t('ai.tasks.metadata.counts')}>
              <Field label={t('ai.task.totalItems')}>
                <span className="tabular-nums">{task.totalItems ?? '-'}</span>
              </Field>
              <Field label={t('ai.task.completedItems')}>
                <span className="tabular-nums">
                  {task.completedItems ?? '-'}
                </span>
              </Field>
            </MetadataGroup>
          </div>
        </CollapsibleSection>
      </Scroll>
    </div>
  )
}

function MetadataGroup(props: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {props.title}
      </h4>
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {props.children}
      </div>
    </div>
  )
}
