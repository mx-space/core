import { Link } from 'react-router'

import type { IPAggregate } from '~/api/analyze'
import { useI18n } from '~/i18n'
import { cn } from '~/utils/cn'

export function DeskTrafficCard(props: { today?: IPAggregate['today'] }) {
  const { format, t } = useI18n()

  const hours = Array.from({ length: 24 }, (_, i) => {
    const label = `${i}:00`
    let pv = 0
    let ip = 0
    for (const entry of props.today ?? []) {
      if (entry.hour !== label) continue
      if (entry.key === 'pv') pv = entry.value
      else ip = entry.value
    }
    return { ip, label, pv }
  })
  const totalPv = hours.reduce((sum, hour) => sum + hour.pv, 0)
  const max = Math.max(...hours.map((hour) => hour.pv), 1)

  return (
    <section className="shadow-sm overflow-hidden rounded-lg border border-border bg-surface-card">
      <Link
        className="focus-visible:outline-hidden block px-4 py-3 transition-colors hover:bg-surface-inset focus-visible:ring-[3px] focus-visible:ring-accent/15"
        to="/analyze"
      >
        <h2 className="flex items-baseline justify-between text-sm font-medium text-fg">
          {t('dashboard.desk.traffic.title')}
          <span className="text-xs font-normal tabular-nums text-fg-muted">
            {t('dashboard.desk.traffic.total', {
              count: format.number(totalPv),
            })}
          </span>
        </h2>
        <div className="mt-3 flex h-16 items-end gap-px">
          {hours.map((hour) => (
            <span
              className={cn(
                'flex-1 rounded-full',
                hour.pv > 0 ? 'bg-accent' : 'bg-surface-inset',
              )}
              key={hour.label}
              style={{
                height:
                  hour.pv > 0
                    ? `${Math.max((hour.pv / max) * 100, 8)}%`
                    : '3px',
              }}
              title={t('dashboard.desk.traffic.tooltip', {
                hour: hour.label,
                ip: format.number(hour.ip),
                pv: format.number(hour.pv),
              })}
            />
          ))}
        </div>
      </Link>
    </section>
  )
}
