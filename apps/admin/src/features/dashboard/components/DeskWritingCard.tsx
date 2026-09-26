import { Link } from 'react-router'

import { refTypeMeta } from '~/features/drafts/constants'
import { useI18n } from '~/i18n'
import type { TranslationKey } from '~/i18n/types'
import type { BadgeTone } from '~/ui/primitives/badge'
import { relativeTimeFromNow } from '~/utils/time'

import type { DeskWritingItem, DeskWritingStatus } from '../utils/desk'
import { deskFocusClassName, DeskSection } from './DeskSection'

export const writingStatusMeta: Record<
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

export function DeskWritingCard(props: {
  className?: string
  items: DeskWritingItem[]
  total: number
}) {
  const { format, t } = useI18n()

  return (
    <DeskSection
      aside={t('dashboard.desk.writing.count', { count: props.total })}
      className={props.className}
      title={t('dashboard.desk.writing.title')}
    >
      <ul>
        {props.items.map((item) => {
          const time =
            item.status === 'scheduled'
              ? format.dateTime(item.time, {
                  dateStyle: 'medium',
                  timeStyle: undefined,
                })
              : relativeTimeFromNow(item.time)
          return (
            <li
              className="border-b border-border last:border-b-0"
              key={item.id}
            >
              <Link
                className={`group grid grid-cols-[minmax(0,1fr)_auto_5rem] items-center gap-4 py-3 phone:grid-cols-[minmax(0,1fr)_auto] phone:gap-x-3 phone:gap-y-0.5 ${deskFocusClassName}`}
                to={item.to}
              >
                <span className="truncate text-sm text-fg transition-colors group-hover:text-accent">
                  {item.title || t('dashboard.desk.untitled')}
                  {item.branchCount > 1 ? (
                    <span className="ml-2 text-xs text-fg-subtle phone:hidden">
                      {t('dashboard.desk.writing.branches', {
                        count: item.branchCount,
                      })}
                    </span>
                  ) : null}
                </span>
                <span className="whitespace-nowrap text-xs text-fg-subtle phone:col-start-1 phone:row-start-2">
                  {t(refTypeMeta[item.refType].labelKey)} ·{' '}
                  {t(writingStatusMeta[item.status].labelKey)}
                </span>
                <span className="text-right text-xs tabular-nums text-fg-subtle phone:col-start-2 phone:row-span-2 phone:row-start-1">
                  {time}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </DeskSection>
  )
}
