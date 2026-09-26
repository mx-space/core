import { useMemo } from 'react'

import type { HeatmapDay } from '~/api/aggregate'
import { useI18n } from '~/i18n'

import { buildWeeklyRhythm } from '../utils/rhythm'
import { DeskSection } from './DeskSection'

const barWidth = 9
const barGap = 4.6
const chartHeight = 72

export function DeskRhythmCard(props: {
  className?: string
  days: HeatmapDay[]
}) {
  const { format, t } = useI18n()
  const rhythm = useMemo(() => buildWeeklyRhythm(props.days), [props.days])
  const unit = chartHeight / Math.max(rhythm.max, 1)
  const width = rhythm.weeks.length * (barWidth + barGap) - barGap

  return (
    <DeskSection
      aside={
        <span className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-xs bg-accent" />
            {t('dashboard.desk.stats.posts')}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-xs bg-accent/35" />
            {t('dashboard.desk.stats.notes')}
          </span>
        </span>
      }
      className={props.className}
      title={
        <span className="tabular-nums">
          {t('dashboard.desk.rhythm.title')} ·{' '}
          {t('dashboard.desk.rhythm.summary', {
            streak: rhythm.streak,
            thisWeek: rhythm.thisWeek,
            total: rhythm.total,
          })}
        </span>
      }
    >
      <div className="overflow-x-auto">
        <svg
          className="block min-w-[560px]"
          height={chartHeight}
          preserveAspectRatio="none"
          viewBox={`0 0 ${width} ${chartHeight}`}
          width="100%"
        >
          {rhythm.weeks.map((week, index) => {
            const x = index * (barWidth + barGap)
            const isCurrent = index === rhythm.weeks.length - 1
            const title = t('dashboard.desk.rhythm.tooltip', {
              date: format.dateTime(week.start, {
                dateStyle: 'medium',
                timeStyle: undefined,
              }),
              notes: week.notes,
              posts: week.posts,
            })
            if (week.posts + week.notes === 0) {
              return (
                <rect
                  className="fill-surface-inset"
                  height={2}
                  key={week.key}
                  rx={1}
                  width={barWidth}
                  x={x}
                  y={chartHeight - 2}
                >
                  <title>{title}</title>
                </rect>
              )
            }
            return (
              <g key={week.key} opacity={isCurrent ? 1 : 0.85}>
                <title>{title}</title>
                <rect
                  className="fill-accent/35"
                  height={week.notes * unit}
                  rx={1.5}
                  width={barWidth}
                  x={x}
                  y={chartHeight - (week.posts + week.notes) * unit}
                />
                <rect
                  className="fill-accent"
                  height={week.posts * unit}
                  rx={1.5}
                  width={barWidth}
                  x={x}
                  y={chartHeight - week.posts * unit}
                />
              </g>
            )
          })}
        </svg>
        <div className="mt-1 grid min-w-[560px] grid-cols-12 text-xs text-fg-subtle">
          {rhythm.months.map((month) => (
            <span key={month.key}>
              {format.dateTime(month.date, {
                dateStyle: undefined,
                month: 'short',
                timeStyle: undefined,
              })}
            </span>
          ))}
        </div>
      </div>
    </DeskSection>
  )
}
