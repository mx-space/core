import { useI18n } from '~/i18n'
import { StatusPill } from '~/ui/data/StatusPill'

import type { PremiumStatus } from './premium-status'
import { splitDuration } from './premium-status'

const PILL_TONE = {
  archived: 'archived',
  'free-window': 'live',
  pending: 'pending',
} as const

const PILL_LABEL = {
  archived: 'write.premium.status.pill.archived',
  'free-window': 'write.premium.status.pill.freeWindow',
  pending: 'write.premium.status.pill.pending',
} as const

export function PremiumStatusLine(props: { status: PremiumStatus }) {
  const { format, t } = useI18n()
  const { status } = props

  const text = (() => {
    switch (status.kind) {
      case 'pending': {
        return status.freeWindowHours === 0
          ? t('write.premium.status.pendingImmediate')
          : t('write.premium.status.pending', { hours: status.freeWindowHours })
      }
      case 'free-window': {
        const { days, hours } = splitDuration(status.remainingMs)
        return t('write.premium.status.freeWindow', {
          remaining:
            days > 0
              ? t('write.premium.remaining.dayHour', { days, hours })
              : t('write.premium.remaining.hour', { hours }),
          until: format.dateTime(status.freeUntil),
        })
      }
      case 'archived': {
        return t('write.premium.status.archived', {
          count: status.previewBlocks,
        })
      }
    }
  })()

  return (
    <div className="flex items-start gap-2">
      <StatusPill className="shrink-0" tone={PILL_TONE[status.kind]}>
        {t(PILL_LABEL[status.kind])}
      </StatusPill>
      <p className="text-xs leading-5 text-fg-muted">{text}</p>
    </div>
  )
}
