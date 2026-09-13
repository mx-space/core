import { Link } from 'react-router'

import type { IPAggregate } from '~/api/analyze'
import { useI18n } from '~/i18n'

import { deskHeaderClassName, deskSectionClassName } from './DeskCard'

const chartWidth = 240
const chartHeight = 48
const step = chartWidth / 24

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
  const points = hours.map((hour, index) => [
    index * step + step / 2,
    chartHeight - (hour.pv / max) * (chartHeight - 2) - 1,
  ])
  const line = points
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`)
    .join(' ')
  const area = `${line} L${points.at(-1)![0]} ${chartHeight} L${points[0][0]} ${chartHeight} Z`

  return (
    <section className={deskSectionClassName}>
      <Link
        className="focus-visible:outline-hidden block transition-colors hover:bg-surface-inset focus-visible:ring-[3px] focus-visible:ring-accent/15"
        to="/analyze"
      >
        <h2 className={deskHeaderClassName}>
          {t('dashboard.desk.traffic.title')}
          <span className="text-xs font-normal tabular-nums text-fg-muted">
            {t('dashboard.desk.traffic.total', {
              count: format.number(totalPv),
            })}
          </span>
        </h2>
        <div className="px-3.5 pb-2 pt-2.5 phone:px-0">
          <svg
            className="block h-12 w-full"
            preserveAspectRatio="none"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          >
            <path className="fill-accent/15" d={area} />
            <path
              className="stroke-accent"
              d={line}
              fill="none"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
            {hours.map((hour, index) => (
              <rect
                fill="transparent"
                height={chartHeight}
                key={hour.label}
                width={step}
                x={index * step}
                y={0}
              >
                <title>
                  {t('dashboard.desk.traffic.tooltip', {
                    hour: hour.label,
                    ip: format.number(hour.ip),
                    pv: format.number(hour.pv),
                  })}
                </title>
              </rect>
            ))}
          </svg>
          <div className="mt-1 flex justify-between text-xs text-fg-subtle">
            <span>0:00</span>
            <span>12:00</span>
            <span>23:00</span>
          </div>
        </div>
      </Link>
    </section>
  )
}
