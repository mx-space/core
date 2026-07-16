import { Ban, Laptop, Loader2 } from 'lucide-react'

import type { CompanionDevice, CompanionDeviceScope } from '~/api/companion'
import { useI18n } from '~/i18n'
import type { TranslationKey } from '~/i18n/types'
import { Badge } from '~/ui/primitives/badge'
import { Button } from '~/ui/primitives/button'

const scopeLabelKeys: Record<CompanionDeviceScope, TranslationKey> = {
  'companion:moment:write': 'companion.scope.momentWrite',
  'companion:presence:write': 'companion.scope.presenceWrite',
  'companion:reading:read': 'companion.scope.readingRead',
  'companion:reading:write': 'companion.scope.readingWrite',
}

interface CompanionDeviceRowProps {
  device: CompanionDevice
  isRevoking: boolean
  onRevoke: () => void
}

export function CompanionDeviceRow(props: CompanionDeviceRowProps) {
  const { format, t } = useI18n()
  const isRevoked = props.device.revokedAt !== null

  return (
    <li
      className="flex flex-col gap-4 bg-surface-card p-4 sm:flex-row sm:items-center sm:justify-between"
      data-testid={`companion-device-${props.device.id}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-border bg-surface-inset text-fg-muted">
          <Laptop aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-fg">
              {props.device.name}
            </h3>
            <Badge tone={isRevoked ? 'neutral' : 'success'}>
              {isRevoked
                ? t('companion.devices.revoked')
                : t('companion.devices.paired')}
            </Badge>
          </div>
          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
            <div className="flex gap-1">
              <dt>{t('companion.devices.lastSeen')}</dt>
              <dd title={format.dateTime(props.device.lastSeenAt)}>
                {props.device.lastSeenAt
                  ? format.relativeTime(props.device.lastSeenAt)
                  : t('companion.devices.never')}
              </dd>
            </div>
            <div className="flex gap-1">
              <dt>{t('companion.devices.createdAt')}</dt>
              <dd>{format.dateTime(props.device.createdAt)}</dd>
            </div>
          </dl>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {props.device.scopes.map((scope) => (
              <Badge key={scope} size="sm" tone="neutral" variant="soft">
                {t(scopeLabelKeys[scope])}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <Button
        className="shrink-0 text-red-700 hover:text-red-800 dark:text-red-300 dark:hover:text-red-200"
        data-testid={`companion-revoke-${props.device.id}`}
        disabled={isRevoked || props.isRevoking}
        onClick={props.onRevoke}
        type="button"
        variant="secondary"
      >
        {props.isRevoking ? (
          <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
        ) : (
          <Ban aria-hidden="true" className="size-3.5" />
        )}
        {props.isRevoking
          ? t('companion.devices.revoking')
          : t('companion.devices.revoke')}
      </Button>
    </li>
  )
}
