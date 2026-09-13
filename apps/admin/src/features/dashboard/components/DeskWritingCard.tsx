import { Link } from 'react-router'

import { refTypeMeta } from '~/features/drafts/constants'
import { useI18n } from '~/i18n'
import type { TranslationKey } from '~/i18n/types'
import { Badge, type BadgeTone } from '~/ui/primitives/badge'
import { relativeTimeFromNow } from '~/utils/time'

import type { DeskWritingItem, DeskWritingStatus } from '../utils/desk'
import { DeskCard } from './DeskCard'

const statusMeta: Record<
  DeskWritingStatus,
  { labelKey: TranslationKey; tone: BadgeTone }
> = {
  modified: {
    labelKey: 'dashboard.desk.writing.status.modified',
    tone: 'warning',
  },
  scheduled: {
    labelKey: 'dashboard.desk.writing.status.scheduled',
    tone: 'neutral',
  },
  unpublished: {
    labelKey: 'dashboard.desk.writing.status.unpublished',
    tone: 'accent',
  },
}

export function DeskWritingCard(props: { items: DeskWritingItem[] }) {
  const { format, t } = useI18n()

  return (
    <DeskCard
      title={t('dashboard.desk.writing.title')}
      aside={t('dashboard.desk.writing.count', { count: props.items.length })}
    >
      {props.items.map((item) => {
        const status = statusMeta[item.status]
        const time =
          item.status === 'scheduled'
            ? format.dateTime(item.time, {
                dateStyle: 'medium',
                timeStyle: undefined,
              })
            : relativeTimeFromNow(item.time)
        return (
          <li
            className="flex items-center gap-3 border-b border-border px-3.5 py-1.5 last:border-b-0 hover:bg-surface-inset phone:px-0"
            key={item.id}
          >
            <Badge size="sm" tone={refTypeMeta[item.refType].tone}>
              {t(refTypeMeta[item.refType].labelKey)}
            </Badge>
            <Link
              className="focus-visible:outline-hidden min-w-0 flex-1 truncate text-sm text-fg focus-visible:ring-[3px] focus-visible:ring-accent/15"
              to={item.to}
            >
              {item.title || t('dashboard.desk.untitled')}
            </Link>
            {item.branchCount > 1 && item.draftId ? (
              <Link
                className="shrink-0 text-xs text-fg-muted hover:text-accent"
                to={`/drafts/${item.draftId}`}
              >
                {t('dashboard.desk.writing.branches', {
                  count: item.branchCount,
                })}
              </Link>
            ) : null}
            <Badge size="sm" tone={status.tone}>
              {t(status.labelKey)}
            </Badge>
            <span className="w-16 shrink-0 text-right text-xs tabular-nums text-fg-subtle">
              {time}
            </span>
          </li>
        )
      })}
    </DeskCard>
  )
}
