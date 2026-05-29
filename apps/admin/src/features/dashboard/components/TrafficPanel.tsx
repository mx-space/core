import { useI18n } from '~/i18n'
import { Panel } from '~/ui/primitives/panel'

import { formatNumber } from '../utils/dashboard'

function TrafficGroup(props: {
  items: Array<{ count: number; name: string }>
  title: string
}) {
  const { t } = useI18n()
  return (
    <div className="bg-white p-4 dark:bg-neutral-950">
      <h3 className="mb-3 text-xs font-medium uppercase text-neutral-500">
        {props.title}
      </h3>
      <div className="space-y-2">
        {props.items.length === 0 ? (
          <p className="text-sm text-neutral-500">{t('dashboard.empty')}</p>
        ) : (
          props.items.slice(0, 6).map((item) => (
            <div
              className="flex items-center justify-between gap-3 text-sm"
              key={item.name}
            >
              <span className="truncate text-neutral-600 dark:text-neutral-300">
                {item.name}
              </span>
              <span className="tabular-nums">{formatNumber(item.count)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function TrafficPanel(props: {
  data?: {
    browser: Array<{ count: number; name: string }>
    os: Array<{ count: number; name: string }>
  }
}) {
  const { t } = useI18n()
  return (
    <Panel title={t('dashboard.traffic.title')}>
      <div className="grid gap-px bg-neutral-200 sm:grid-cols-2 dark:bg-neutral-800">
        <TrafficGroup
          items={props.data?.browser ?? []}
          title={t('dashboard.traffic.browser')}
        />
        <TrafficGroup
          items={props.data?.os ?? []}
          title={t('dashboard.traffic.os')}
        />
      </div>
    </Panel>
  )
}
