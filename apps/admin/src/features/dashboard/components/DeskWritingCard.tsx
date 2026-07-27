import { Clock3 } from 'lucide-react'

import { refTypeMeta } from '~/features/drafts/constants'
import { useI18n } from '~/i18n'
import type { TranslationKey } from '~/i18n/types'
import { DraftRefType } from '~/models/draft'
import { relativeTimeFromNow } from '~/utils/time'

import type { DeskWritingItem } from '../utils/desk'
import { DeskCard, DeskRow } from './DeskCard'

const draftTypeKey: Record<DraftRefType, TranslationKey> = {
  [DraftRefType.Note]: 'dashboard.desk.draftType.note',
  [DraftRefType.Page]: 'dashboard.desk.draftType.page',
  [DraftRefType.Post]: 'dashboard.desk.draftType.post',
}

export function DeskWritingCard(props: { items: DeskWritingItem[] }) {
  const { format, t } = useI18n()

  return (
    <DeskCard title={t('dashboard.desk.continue.title')}>
      {props.items.map((item) => {
        const Icon =
          item.kind === 'draft' ? refTypeMeta[item.refType].icon : Clock3
        const meta =
          item.kind === 'draft'
            ? t('dashboard.desk.draftMeta', {
                time: relativeTimeFromNow(item.updatedAt),
                type: t(draftTypeKey[item.refType]),
              })
            : t('dashboard.desk.scheduledMeta', {
                date: format.dateTime(item.publicAt, {
                  dateStyle: 'medium',
                  timeStyle: undefined,
                }),
              })

        return (
          <DeskRow key={`${item.kind}-${item.id}`} to={item.to}>
            <Icon
              aria-hidden="true"
              className="size-4 shrink-0 text-fg-subtle"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-fg">
                {item.title || t('dashboard.desk.untitled')}
              </span>
              <span className="mt-0.5 block truncate text-xs text-fg-muted">
                {meta}
              </span>
            </span>
          </DeskRow>
        )
      })}
    </DeskCard>
  )
}
