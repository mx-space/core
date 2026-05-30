import { Globe, Shield } from 'lucide-react'

import { IpInfoPopover } from '~/features/_shared/components/ip-info-popover'
import { useI18n } from '~/i18n'

import { formatDateTime } from '../utils/dashboard'

export function OwnerLoginStat(props: {
  lastLoginIp?: string
  lastLoginTime?: string
}) {
  const { t } = useI18n()
  if (!props.lastLoginIp && !props.lastLoginTime) return null

  return (
    <div className="grid gap-2 border-t border-border py-4 text-sm text-fg-muted sm:grid-cols-2">
      <div className="inline-flex min-w-0 items-center gap-2">
        <Shield aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
        <span className="shrink-0">{t('dashboard.owner.lastLoginTime')}</span>
        <time
          className="min-w-0 truncate text-fg"
          dateTime={props.lastLoginTime}
        >
          {props.lastLoginTime ? formatDateTime(props.lastLoginTime) : 'N/A'}
        </time>
      </div>
      <div className="inline-flex min-w-0 items-center gap-2 sm:justify-end">
        <Globe aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
        <span className="shrink-0">{t('dashboard.owner.lastLoginIp')}</span>
        {props.lastLoginIp ? (
          <IpInfoPopover
            className="inline-flex min-w-0 items-center gap-1.5 text-fg hover:underline"
            ip={props.lastLoginIp}
            trigger={<span className="truncate">{props.lastLoginIp}</span>}
          />
        ) : (
          <span className="text-fg">N/A</span>
        )}
      </div>
    </div>
  )
}
