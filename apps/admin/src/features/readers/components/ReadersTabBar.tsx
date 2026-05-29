import type { ReaderRoleFilter, ReaderStats } from '~/api/readers'

import { useI18n } from '~/i18n'
import { cn } from '~/utils/cn'

import { ROLE_TABS } from '../constants'

interface ReadersTabBarProps {
  role: ReaderRoleFilter
  stats: ReaderStats | undefined
  onRoleChange: (role: ReaderRoleFilter) => void
}

const STAT_KEY: Record<ReaderRoleFilter, keyof ReaderStats> = {
  all: 'all',
  owner: 'owner',
  reader: 'reader',
}

export function ReadersTabBar(props: ReadersTabBarProps) {
  const { t } = useI18n()

  return (
    <div className="flex flex-wrap gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
      {ROLE_TABS.map((tab) => {
        const active = props.role === tab.value
        const count = props.stats?.[STAT_KEY[tab.value]]
        return (
          <button
            className={cn(
              'inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs transition-colors',
              active
                ? 'border-neutral-950 bg-neutral-950 text-white dark:border-neutral-50 dark:bg-neutral-50 dark:text-neutral-950'
                : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900',
            )}
            key={tab.value}
            onClick={() => props.onRoleChange(tab.value)}
            type="button"
          >
            <span>{t(tab.labelKey)}</span>
            {count !== undefined ? (
              <span
                className={cn(
                  'tabular-nums',
                  active
                    ? 'text-white/70 dark:text-neutral-950/60'
                    : 'text-neutral-400 dark:text-neutral-500',
                )}
              >
                {count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
