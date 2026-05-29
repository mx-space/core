import { Panel } from '~/ui/primitives/panel'

import { formatNumber } from '../utils/dashboard'
import { EmptyDashboardBlock } from './DashboardPrimitives'

export function BarPanel(props: {
  items: Array<{ label: string; value: number }>
  title: string
}) {
  const max = Math.max(...props.items.map((item) => item.value), 1)

  return (
    <Panel title={props.title}>
      <div className="space-y-3 p-4">
        {props.items.length === 0 ? (
          <EmptyDashboardBlock />
        ) : (
          props.items.slice(-8).map((item) => (
            <div
              className="grid grid-cols-[8rem_minmax(0,1fr)_4rem] items-center gap-3 text-sm"
              key={item.label}
            >
              <span className="truncate text-neutral-500">{item.label}</span>
              <span className="h-2 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-900">
                <span
                  className="block h-full rounded bg-neutral-900 dark:bg-neutral-100"
                  style={{ width: `${Math.max((item.value / max) * 100, 2)}%` }}
                />
              </span>
              <span className="text-right tabular-nums">
                {formatNumber(item.value)}
              </span>
            </div>
          ))
        )}
      </div>
    </Panel>
  )
}
