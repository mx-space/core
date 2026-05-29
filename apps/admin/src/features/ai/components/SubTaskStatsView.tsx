import type { AITask } from '~/api/ai'

import { useI18n } from '~/i18n'
import { cn } from '~/utils/cn'

import { SmallBadge } from './AiPrimitives'

export function SubTaskStatsView(props: { task: AITask }) {
  const { t } = useI18n()
  const stats = props.task.subTaskStats
  if (!stats || stats.total <= 0) return null

  const completeOrFailed = stats.completed + stats.failed
  const progress = (completeOrFailed / stats.total) * 100

  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
        <span>{t('ai.task.subProgress')}</span>
        <span className="tabular-nums">
          {completeOrFailed} / {stats.total}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-900">
        <div
          className={cn(
            'h-full rounded transition-[width]',
            stats.failed > 0 ? 'bg-red-500' : 'bg-blue-500',
          )}
          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs tabular-nums">
        <SmallBadge tone="success">
          {t('ai.task.subStats.completed', { count: stats.completed })}
        </SmallBadge>
        <SmallBadge tone="info">
          {t('ai.task.subStats.running', { count: stats.running })}
        </SmallBadge>
        <SmallBadge>
          {t('ai.task.subStats.pending', { count: stats.pending })}
        </SmallBadge>
        {stats.failed > 0 ? (
          <SmallBadge tone="danger">
            {t('ai.task.subStats.failed', { count: stats.failed })}
          </SmallBadge>
        ) : null}
      </div>
    </div>
  )
}
