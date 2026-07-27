import { Heart, MessageSquare } from 'lucide-react'

import type { RecentActivityComment, RecentActivityLike } from '~/api/activity'
import { useI18n } from '~/i18n'
import type { TranslationKey, TranslationValues } from '~/i18n/types'
import { relativeTimeFromNow } from '~/utils/time'

import { DeskCard, DeskRow } from './DeskCard'

const echoRowLimit = 4

interface EchoRow {
  createdAt: string
  icon: typeof MessageSquare
  iconClassName: string
  key: string
  meta: string
  text: string
  to?: string
}

function editPathFor(type?: string, id?: string) {
  if (!id) return undefined
  if (type === 'post') return `/posts/edit?id=${encodeURIComponent(id)}`
  if (type === 'note') return `/notes/edit?id=${encodeURIComponent(id)}`
  return undefined
}

export function buildEchoRows(
  comments: RecentActivityComment[],
  likes: RecentActivityLike[],
  t: (key: TranslationKey, params?: TranslationValues) => string,
): EchoRow[] {
  const commentRows = comments.map((comment, index): EchoRow => {
    return {
      createdAt: comment.createdAt,
      icon: MessageSquare,
      iconClassName: 'text-fg-subtle',
      key: `comment-${comment.id ?? index}-${comment.createdAt}`,
      meta: `${comment.text} · ${relativeTimeFromNow(comment.createdAt)}`,
      text: t('dashboard.desk.echo.comment', {
        author: comment.author,
        title: comment.title ?? '',
      }),
      to: editPathFor(comment.type, comment.id),
    }
  })

  const likeGroups = new Map<
    string,
    { count: number; latest: RecentActivityLike }
  >()
  for (const like of likes) {
    const groupKey = like.title ?? like.id
    const group = likeGroups.get(groupKey)
    if (group) {
      group.count += 1
      if (like.createdAt > group.latest.createdAt) group.latest = like
    } else {
      likeGroups.set(groupKey, { count: 1, latest: like })
    }
  }
  const likeRows = [...likeGroups.entries()].map(
    ([groupKey, group]): EchoRow => ({
      createdAt: group.latest.createdAt,
      icon: Heart,
      iconClassName: 'text-red-400',
      key: `like-${groupKey}`,
      meta: relativeTimeFromNow(group.latest.createdAt),
      text: t('dashboard.desk.echo.likes', {
        count: group.count,
        title: group.latest.title ?? '',
      }),
    }),
  )

  return [...commentRows, ...likeRows]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, echoRowLimit)
}

export function DeskEchoCard(props: { rows: EchoRow[] }) {
  const { t } = useI18n()

  return (
    <DeskCard title={t('dashboard.desk.echo.title')}>
      {props.rows.map((row) => (
        <DeskRow key={row.key} to={row.to}>
          <row.icon
            aria-hidden="true"
            className={`size-4 shrink-0 ${row.iconClassName}`}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-fg">{row.text}</span>
            <span className="mt-0.5 block truncate text-xs text-fg-muted">
              {row.meta}
            </span>
          </span>
        </DeskRow>
      ))}
    </DeskCard>
  )
}
