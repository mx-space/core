import { useI18n } from '~/i18n'
import { Panel } from '~/ui/primitives/panel'

import { formatNumber } from '../utils/dashboard'

function TrafficGroup(props: {
  items: Array<{ count: number; name: string }>
  title: string
}) {
  const { t } = useI18n()
  return (
    <div className="bg-surface-card p-4">
      <h3 className="mb-3 text-xs font-medium uppercase text-fg-muted">
        {props.title}
      </h3>
      <div className="space-y-2">
        {props.items.length === 0 ? (
          <p className="text-sm text-fg-muted">{t('dashboard.empty')}</p>
        ) : (
          props.items.slice(0, 6).map((item) => (
            <div
              className="flex items-center justify-between gap-3 text-sm"
              key={item.name}
            >
              <span className="truncate text-fg-muted">{item.name}</span>
              <span className="tabular-nums text-fg">
                {formatNumber(item.count)}
              </span>
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
      <div className="grid gap-px bg-border sm:grid-cols-2">
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
