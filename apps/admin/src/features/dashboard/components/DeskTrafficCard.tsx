import { useQuery } from '@tanstack/react-query'

import { getAnalyzeAggregate } from '~/api/analyze'
import { useI18n } from '~/i18n'

import { dashboardQueryKeys } from '../constants'
import { DeskItem, DeskRailSection } from './DeskSection'
import { DeskSkeletonBar } from './DeskSkeleton'

const chartWidth = 240
const chartHeight = 48
const step = chartWidth / 24

export function DeskTrafficCard(props: { className?: string }) {
  const { format, t } = useI18n()
  const trafficQuery = useQuery({
    queryFn: getAnalyzeAggregate,
    queryKey: dashboardQueryKeys.analyzeAggregate,
  })
  const today = trafficQuery.data?.today ?? []

  const hours = Array.from({ length: 24 }, (_, i) => {
    const label = `${i}:00`
    let pv = 0
    let ip = 0
    for (const entry of today) {
      if (entry.hour !== label) continue
      if (entry.key === 'pv') pv = entry.value
      else ip = entry.value
    }
    return { ip, label, pv }
  })
  const totalPv = hours.reduce((sum, hour) => sum + hour.pv, 0)
  const totalIp = hours.reduce((sum, hour) => sum + hour.ip, 0)
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
    <DeskRailSection
      className={props.className}
      title={t('dashboard.desk.traffic.title')}
    >
      <DeskItem to="/analyze">
        {trafficQuery.isPending ? (
          <>
            <DeskSkeletonBar className="h-7 w-32" />
            <DeskSkeletonBar className="mt-2.5 h-12 w-full" />
          </>
        ) : (
          <>
            <span className="flex h-7 items-baseline gap-2.5 tabular-nums">
              <span className="text-xl font-semibold text-fg transition-colors group-hover:text-accent">
                {t('dashboard.desk.traffic.total', {
                  count: format.number(totalPv),
                })}
              </span>
              <span className="text-xs text-fg-subtle">
                {t('dashboard.desk.traffic.ip', {
                  count: format.number(totalIp),
                })}
              </span>
            </span>
            <svg
              className="mt-2.5 block h-12 w-full"
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
          </>
        )}
        <span className="mt-1 flex justify-between text-xs tabular-nums text-fg-subtle">
          <span>0:00</span>
          <span>12:00</span>
          <span>23:00</span>
        </span>
      </DeskItem>
    </DeskRailSection>
  )
}
