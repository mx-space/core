import { Link } from 'react-router'

import type { StatCount } from '~/api/aggregate'
import { useI18n } from '~/i18n'
import type { TranslationKey } from '~/i18n/types'

import { deskFocusClassName, DeskSection } from './DeskSection'

export function DeskStatBand(props: {
  className?: string
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
    <DeskSection
      className={props.className}
      title={t('dashboard.desk.stats.title')}
    >
      <div className="grid grid-cols-6 phone:grid-cols-3 phone:gap-y-4">
        {cells.map((cell) => (
          <Link
            className={`group min-w-0 border-l border-border px-4 first:border-l-0 first:pl-0 phone:nth-4:border-l-0 phone:nth-4:pl-0 ${deskFocusClassName}`}
            key={cell.labelKey}
            to={cell.to}
          >
            <span className="block truncate text-xs text-fg-subtle">
              {t(cell.labelKey)}
            </span>
            <span className="mt-0.5 flex items-baseline gap-1.5 truncate text-base font-semibold tabular-nums text-fg transition-colors group-hover:text-accent">
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
    </DeskSection>
  )
}
