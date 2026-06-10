import type { ReadingRankItem } from '~/api/activity'
import { useI18n } from '~/i18n'
import { cn } from '~/utils/cn'

import { formatNumber } from '../utils/analyze'
import { ReferenceButton } from './ReferenceButton'

export function ReadingRankList(props: { items: ReadingRankItem[] }) {
  const { t } = useI18n()
  const max = Math.max(...props.items.map((item) => item.count), 1)

  return (
    <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
      {props.items.map((item, index) => (
        <div
          className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
          key={item.refId}
        >
          <span
            className={cn(
              'flex size-7 items-center justify-center rounded-full text-xs font-semibold',
              index < 3
                ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400',
            )}
          >
            {index + 1}
          </span>
          <div className="min-w-0">
            <ReferenceButton
              id={item.ref?.id}
              title={item.ref?.title ?? t('analyze.deletedPost')}
            />
            <div className="mt-2 h-1.5 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-900">
              <div
                className="h-full rounded bg-[var(--color-primary)]"
                style={{ width: `${Math.max((item.count / max) * 100, 3)}%` }}
              />
            </div>
          </div>
          <span className="text-sm tabular-nums text-neutral-600 dark:text-neutral-300">
            {formatNumber(item.count)}
          </span>
        </div>
      ))}
    </div>
  )
}
