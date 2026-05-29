import { ArrowLeft, RotateCcw, Trash2, XCircle } from 'lucide-react'

import type { CronTask } from '~/api/cron-tasks'
import { CronTaskStatus } from '~/api/cron-tasks'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import {
  taskStatusIconClassNames,
  taskStatusIcons,
  taskTypeLabelKeys,
} from '../constants'
import { formatDateTime } from '../utils/cron'
import {
  DetailSection,
  LogLine,
  MetadataRow,
  StatusBadge,
} from './CronPrimitives'

export function TaskDetail(props: {
  onBack: () => void
  onCancel: () => void
  onDelete: () => void
  onRetry: () => void
  task: CronTask
}) {
  const { t } = useI18n()
  const task = props.task
  const Icon = taskStatusIcons[task.status]
  const canCancel =
    task.status === CronTaskStatus.Pending ||
    task.status === CronTaskStatus.Running
  const canRetry =
    task.status === CronTaskStatus.Failed ||
    task.status === CronTaskStatus.Cancelled
  const canDelete = [
    CronTaskStatus.Cancelled,
    CronTaskStatus.Completed,
    CronTaskStatus.Failed,
    CronTaskStatus.PartialFailed,
  ].includes(task.status)
  const progress = Math.max(0, Math.min(task.progress ?? 0, 100))

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-5 dark:border-neutral-800',
          APP_SHELL_HEADER_HEIGHT_CLASS,
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <MobileHeaderAffordance />
          <button
            className="inline-flex size-8 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-950 lg:hidden dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-50"
            onClick={props.onBack}
            type="button"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
          </button>
          <div className="flex min-w-0 items-start gap-3">
            <Icon
              aria-hidden="true"
              className={cn(
                'mt-0.5 size-5 shrink-0',
                taskStatusIconClassNames[task.status],
              )}
            />
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-neutral-950 dark:text-neutral-50">
                {taskTypeLabelKeys[task.type]
                  ? t(taskTypeLabelKeys[task.type])
                  : task.type}
              </h2>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                {task.progressMessage || t('cron.detail.fallbackMessage')}
              </p>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={task.status} />
          {task.retryCount > 0 ? (
            <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
              {t('cron.detail.retryBadge', { count: task.retryCount })}
            </span>
          ) : null}
        </div>
      </div>

      <div className="border-b border-neutral-200 px-5 py-3 dark:border-neutral-800">
        {task.progress !== undefined ? (
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-900">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-1 text-xs tabular-nums text-neutral-500">
              {progress}%
            </div>
          </div>
        ) : null}

        {(canCancel || canRetry || canDelete) && (
          <div
            className={cn(
              'flex flex-wrap items-center gap-2',
              task.progress !== undefined ? 'mt-3' : null,
            )}
          >
            {canCancel ? (
              <Button
                className="text-red-600 dark:text-red-400"
                onClick={props.onCancel}
                type="button"
                variant="subtle"
              >
                <XCircle aria-hidden="true" className="size-4" />
                {t('cron.detail.cancel')}
              </Button>
            ) : null}
            {canRetry ? (
              <Button onClick={props.onRetry} type="button" variant="subtle">
                <RotateCcw aria-hidden="true" className="size-4" />
                {t('cron.detail.retry')}
              </Button>
            ) : null}
            {canDelete ? (
              <Button
                className="text-red-600 dark:text-red-400"
                onClick={props.onDelete}
                type="button"
                variant="subtle"
              >
                <Trash2 aria-hidden="true" className="size-4" />
                {t('cron.detail.delete')}
              </Button>
            ) : null}
          </div>
        )}
      </div>

      <Scroll className="flex-1" innerClassName="px-5 py-4">
        {task.error ? (
          <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
            <span className="font-medium">{t('cron.detail.error')}</span>
            {task.error}
          </div>
        ) : null}

        {task.result ? (
          <DetailSection title={t('cron.detail.result')}>
            <Scroll
              className="rounded bg-neutral-100 dark:bg-neutral-900"
              orientation="both"
            >
              <pre className="p-3 font-mono text-xs leading-relaxed text-neutral-800 dark:text-neutral-200">
                {JSON.stringify(task.result, null, 2)}
              </pre>
            </Scroll>
          </DetailSection>
        ) : null}

        <DetailSection
          title={
            <>
              {t('cron.detail.logs')}
              <span className="ml-1 tabular-nums text-neutral-500">
                ({task.logs.length})
              </span>
            </>
          }
        >
          {task.logs.length === 0 ? (
            <div className="rounded bg-neutral-50 px-3 py-6 text-center text-sm text-neutral-500 dark:bg-neutral-900">
              {t('cron.detail.logsEmpty')}
            </div>
          ) : (
            <Scroll
              className="rounded bg-neutral-100 dark:bg-neutral-900"
              innerClassName="p-3"
              orientation="both"
              viewportClassName="max-h-64"
            >
              {task.logs.map((log, index) => (
                <LogLine key={`${log.timestamp}-${index}`} log={log} />
              ))}
            </Scroll>
          )}
        </DetailSection>

        <DetailSection title={t('cron.detail.metadata')}>
          <dl className="grid gap-2 text-xs">
            <MetadataRow label={t('cron.detail.meta.id')} value={task.id} />
            <MetadataRow label={t('cron.detail.meta.type')} value={task.type} />
            {task.workerId ? (
              <MetadataRow
                label={t('cron.detail.meta.worker')}
                value={task.workerId}
              />
            ) : null}
            <MetadataRow
              label={t('cron.detail.meta.createdAt')}
              value={formatDateTime(task.createdAt)}
            />
            {task.startedAt ? (
              <MetadataRow
                label={t('cron.detail.meta.startedAt')}
                value={formatDateTime(task.startedAt)}
              />
            ) : null}
            {task.completedAt ? (
              <MetadataRow
                label={t('cron.detail.meta.completedAt')}
                value={formatDateTime(task.completedAt)}
              />
            ) : null}
          </dl>
        </DetailSection>
      </Scroll>
    </div>
  )
}
