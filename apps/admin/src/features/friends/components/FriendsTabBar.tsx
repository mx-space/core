import type { LinkStateCount } from '~/models/link'

import { useI18n } from '~/i18n'
import { LinkState } from '~/models/link'

import { stateTabs } from '../constants'

export function FriendsTabBar(props: {
  counts?: LinkStateCount
  onChange: (value: LinkState) => void
  value: LinkState
}) {
  const { t } = useI18n()
  return (
    <div className="inline-flex flex-wrap gap-1 rounded border border-neutral-200 bg-white p-1 dark:border-neutral-800 dark:bg-neutral-950">
      {stateTabs.map((tab) => {
        const active = props.value === tab.value
        const count = props.counts?.[tab.countKey] ?? 0

        return (
          <button
            className={[
              'inline-flex h-8 items-center gap-2 rounded px-3 text-sm transition-colors',
              active
                ? 'bg-neutral-950 text-white dark:bg-neutral-50 dark:text-neutral-950'
                : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900',
            ].join(' ')}
            key={tab.value}
            onClick={() => props.onChange(tab.value)}
            type="button"
          >
            {t(tab.labelKey)}
            <span
              className={[
                'rounded-full px-1.5 py-0.5 text-xs',
                active
                  ? 'bg-white/20 text-current dark:bg-black/10'
                  : tab.value === LinkState.Audit && count > 0
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
              ].join(' ')}
            >
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
