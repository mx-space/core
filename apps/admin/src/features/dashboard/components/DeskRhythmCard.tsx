import { useMemo } from 'react'

import type { HeatmapDay } from '~/api/aggregate'
import { useI18n } from '~/i18n'
import { cn } from '~/utils/cn'

export function DeskRhythmCard(props: { days: HeatmapDay[] }) {
  const { format, t } = useI18n()

  const { months, total } = useMemo(() => {
    const counts = new Map<string, number>()
    for (const day of props.days) {
      const key = day.date.slice(0, 7)
      counts.set(key, (counts.get(key) ?? 0) + day.count)
    }
    const now = new Date()
    const built: Array<{ count: number; date: Date; key: string }> = []
    for (let offset = 11; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1)
      const key = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`
      built.push({ count: counts.get(key) ?? 0, date, key })
    }
    return {
      months: built,
      total: props.days.reduce((sum, day) => sum + day.count, 0),
    }
  }, [props.days])

  const max = Math.max(...months.map((month) => month.count), 1)

  return (
    <section className="shadow-sm rounded-lg border border-border bg-surface-card px-4 py-3">
      <h2 className="flex items-baseline justify-between text-sm font-medium text-fg">
        {t('dashboard.desk.heatmap.title')}
        <span className="text-xs font-normal text-fg-muted">
          {t('dashboard.desk.heatmap.total', { count: total })}
        </span>
      </h2>
      <div className="mt-4 flex items-stretch justify-center">
        {months.map((month) => (
          <div
            className="flex w-10 flex-col items-center gap-1.5"
            key={month.key}
            title={t('dashboard.desk.heatmap.tooltip', {
              count: month.count,
              date: format.dateTime(month.date, {
                dateStyle: undefined,
                month: 'short',
                timeStyle: undefined,
                year: 'numeric',
              }),
            })}
          >
            <span className="flex h-24 items-end">
              <span
                className={cn(
                  'w-1.5 rounded-full',
                  month.count > 0 ? 'bg-accent' : 'bg-surface-inset',
                )}
                style={{
                  height:
                    month.count > 0
                      ? `${Math.max((month.count / max) * 100, 12)}%`
                      : '3px',
                }}
              />
            </span>
            <span className="text-xs text-fg-subtle">
              {format.dateTime(month.date, {
                dateStyle: undefined,
                month: 'short',
                timeStyle: undefined,
              })}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
