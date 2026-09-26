import { useMemo } from 'react'

import type { DeskScheduledNote, HeatmapDay } from '~/api/aggregate'
import { useI18n } from '~/i18n'
import { cn } from '~/utils/cn'

import { buildWeekStrip } from '../utils/rhythm'
import { DeskRailSection } from './DeskSection'

export function DeskWeekCard(props: {
  className?: string
  days: HeatmapDay[]
  scheduledNotes: DeskScheduledNote[]
}) {
  const { format, t } = useI18n()
  const strip = useMemo(
    () =>
      buildWeekStrip(
        props.days,
        props.scheduledNotes.map((note) => note.publicAt),
      ),
    [props.days, props.scheduledNotes],
  )

  return (
    <DeskRailSection
      className={props.className}
      title={t('dashboard.desk.week.title')}
    >
      <ol className="grid grid-cols-7 text-center">
        {strip.map((day) => (
          <li className="flex flex-col items-center gap-1.5" key={day.key}>
            <span className="text-xs text-fg-subtle">
              {format.dateTime(day.date, {
                dateStyle: undefined,
                timeStyle: undefined,
                weekday: 'narrow',
              })}
            </span>
            <span
              aria-current={day.isToday ? 'date' : undefined}
              className={cn(
                'grid size-8 place-items-center rounded-full text-sm font-medium tabular-nums',
                day.isToday ? 'bg-fg text-background' : 'text-fg',
              )}
            >
              {day.date.getDate()}
            </span>
            <span
              className={cn(
                'size-1 rounded-full',
                day.published
                  ? 'bg-fg'
                  : day.scheduled
                    ? 'ring-1 ring-accent'
                    : 'invisible',
              )}
            />
          </li>
        ))}
      </ol>
      <p className="mt-3 flex gap-3 text-xs text-fg-subtle">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1 rounded-full bg-fg" />
          {t('dashboard.desk.week.published')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1 rounded-full ring-1 ring-accent" />
          {t('dashboard.desk.writing.status.scheduled')}
        </span>
      </p>
    </DeskRailSection>
  )
}
