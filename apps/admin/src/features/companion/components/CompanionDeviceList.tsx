import { Laptop, RotateCcw } from 'lucide-react'

import type { CompanionDevice } from '~/api/companion'
import { useI18n } from '~/i18n'
import { EmptyState } from '~/ui/patterns/EmptyState'
import { Button } from '~/ui/primitives/button'
import { Panel } from '~/ui/primitives/panel'

import { CompanionDeviceRow } from './CompanionDeviceRow'

interface CompanionDeviceListProps {
  devices: CompanionDevice[]
  isError: boolean
  isLoading: boolean
  onRetry: () => void
  onRevoke: (device: CompanionDevice) => void
  revokingDeviceId: null | string
}

export function CompanionDeviceList(props: CompanionDeviceListProps) {
  const { t } = useI18n()

  return (
    <Panel
      className="overflow-hidden border border-border bg-surface-card"
      description={t('companion.devices.description')}
      title={t('companion.devices.title', { count: props.devices.length })}
    >
      {props.isLoading && props.devices.length === 0 ? (
        <div
          aria-label={t('companion.devices.loading')}
          className="space-y-px bg-border"
          role="status"
        >
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="h-24 animate-pulse bg-surface-card p-4" key={index}>
              <div className="h-4 w-40 rounded-sm bg-surface-inset" />
              <div className="mt-3 h-3 w-64 max-w-full rounded-sm bg-surface-inset" />
            </div>
          ))}
        </div>
      ) : props.isError && props.devices.length === 0 ? (
        <div
          className="flex flex-col items-center gap-3 p-8 text-center"
          role="alert"
        >
          <p className="text-sm text-fg-muted">
            {t('companion.devices.loadFailed')}
          </p>
          <Button onClick={props.onRetry} type="button" variant="secondary">
            <RotateCcw aria-hidden="true" className="size-3.5" />
            {t('companion.action.retry')}
          </Button>
        </div>
      ) : props.devices.length === 0 ? (
        <EmptyState
          className="m-4"
          description={t('companion.devices.emptyDescription')}
          icon={Laptop}
          title={t('companion.devices.emptyTitle')}
        />
      ) : (
        <ul
          className="divide-y divide-border"
          data-testid="companion-device-list"
        >
          {props.devices.map((device) => (
            <CompanionDeviceRow
              device={device}
              isRevoking={props.revokingDeviceId === device.id}
              key={device.id}
              onRevoke={() => props.onRevoke(device)}
            />
          ))}
        </ul>
      )}
    </Panel>
  )
}
