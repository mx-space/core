import { Link } from 'react-router'

import type { StatCount } from '~/api/aggregate'
import { useI18n } from '~/i18n'
import type { TranslationKey } from '~/i18n/types'

export function DeskStatBand(props: {
  pendingComments?: number
  stat?: StatCount
  totalReads?: number
}) {
  const { format, t } = useI18n()
  const { stat, totalReads } = props

  const cells: Array<{
    badge?: string
    labelKey: TranslationKey
    to: string
    value: number
  }> = [
    {
      labelKey: 'dashboard.desk.stats.todayVisitors',
      to: '/insights',
      value: stat?.todayIpAccessCount ?? 0,
    },
    {
      labelKey: 'dashboard.desk.stats.uv',
      to: '/insights',
      value: stat?.uv ?? 0,
    },
    {
      labelKey: 'dashboard.desk.stats.posts',
      to: '/posts',
      value: stat?.posts ?? 0,
    },
    {
      labelKey: 'dashboard.desk.stats.notes',
      to: '/notes',
      value: stat?.notes ?? 0,
    },
    {
      badge: props.pendingComments
        ? t('dashboard.desk.stats.pending', { count: props.pendingComments })
        : undefined,
      labelKey: 'dashboard.desk.stats.comments',
      to: '/comments?state=1',
      value: stat?.allComments ?? stat?.comments ?? 0,
    },
    {
      labelKey: 'dashboard.desk.stats.reads',
      to: '/insights',
      value: totalReads ?? 0,
    },
  ]

  return (
    <div className="shadow-sm grid grid-cols-6 gap-px overflow-hidden rounded-lg border border-border bg-border phone:grid-cols-3">
      {cells.map((cell) => (
        <Link
          className="focus-visible:outline-hidden min-w-0 bg-surface-card px-3.5 py-2 transition-colors hover:bg-surface-inset focus-visible:ring-[3px] focus-visible:ring-accent/15"
          key={cell.labelKey}
          to={cell.to}
        >
          <span className="block truncate text-xs text-fg-muted">
            {t(cell.labelKey)}
          </span>
          <span className="mt-0.5 flex items-baseline gap-1.5 truncate text-base font-semibold tabular-nums text-fg">
            {format.number(cell.value)}
            {cell.badge ? (
              <span className="text-xs font-medium text-accent">
                {cell.badge}
              </span>
            ) : null}
          </span>
        </Link>
      ))}
    </div>
  )
}
