import type { OnThisDayEntry } from '~/api/aggregate'
import { useI18n } from '~/i18n'

import { DeskItem, DeskSectionTitle } from './DeskSection'

const onThisDayLimit = 3

function editPathFor(entry: OnThisDayEntry) {
  const base = entry.type === 'post' ? '/posts/edit' : '/notes/edit'
  return `${base}?id=${encodeURIComponent(entry.id)}`
}

export function DeskOnThisDayCard(props: { entries: OnThisDayEntry[] }) {
  const { t } = useI18n()
  const currentYear = new Date().getFullYear()

  return (
    <section className="min-w-0">
      <DeskSectionTitle title={t('dashboard.desk.onThisDay.title')} />
      {props.entries.slice(0, onThisDayLimit).map((entry) => (
        <DeskItem className="py-2.5" key={entry.id} to={editPathFor(entry)}>
          <span className="block truncate text-sm font-medium text-fg transition-colors group-hover:text-accent">
            {entry.title || t('dashboard.desk.untitled')}
          </span>
          <span className="mt-0.5 block text-xs tabular-nums text-fg-subtle">
            {t('dashboard.desk.onThisDay.yearsAgo', {
              count: Math.max(
                1,
                currentYear - new Date(entry.created).getFullYear(),
              ),
            })}{' '}
            ·{' '}
            {t(
              entry.type === 'post'
                ? 'dashboard.desk.onThisDay.type.post'
                : 'dashboard.desk.onThisDay.type.note',
            )}
          </span>
        </DeskItem>
      ))}
    </section>
  )
}
