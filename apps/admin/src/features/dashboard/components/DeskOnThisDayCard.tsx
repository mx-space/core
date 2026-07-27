import type { OnThisDayEntry } from '~/api/aggregate'
import { useI18n } from '~/i18n'

import { DeskCard, DeskRow } from './DeskCard'

function editPathFor(entry: OnThisDayEntry) {
  const base = entry.type === 'post' ? '/posts/edit' : '/notes/edit'
  return `${base}?id=${encodeURIComponent(entry.id)}`
}

export function DeskOnThisDayCard(props: { entries: OnThisDayEntry[] }) {
  const { t } = useI18n()
  const [featured, ...rest] = props.entries
  if (!featured) return null

  const currentYear = new Date().getFullYear()
  const yearsAgo = Math.max(
    1,
    currentYear - new Date(featured.created).getFullYear(),
  )
  const typeLabel = t(
    featured.type === 'post'
      ? 'dashboard.desk.onThisDay.type.post'
      : 'dashboard.desk.onThisDay.type.note',
  )

  return (
    <DeskCard title={t('dashboard.desk.onThisDay.title')}>
      <DeskRow to={editPathFor(featured)}>
        <span className="min-w-0 flex-1 border-l-2 border-accent pl-3">
          <span className="block truncate text-sm text-fg">
            {featured.title || t('dashboard.desk.untitled')}
          </span>
          {featured.excerpt ? (
            <span className="mt-0.5 line-clamp-2 block text-xs text-fg-muted">
              {featured.excerpt}
            </span>
          ) : null}
          <span className="mt-1 block text-xs text-fg-subtle">
            {t('dashboard.desk.onThisDay.yearsAgo', { count: yearsAgo })} ·{' '}
            {typeLabel}
          </span>
        </span>
      </DeskRow>
      {rest.map((entry) => (
        <DeskRow key={entry.id} to={editPathFor(entry)}>
          <span className="w-12 shrink-0 text-xs tabular-nums text-fg-subtle">
            {new Date(entry.created).getFullYear()}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-fg">
            {entry.title || t('dashboard.desk.untitled')}
          </span>
        </DeskRow>
      ))}
    </DeskCard>
  )
}
