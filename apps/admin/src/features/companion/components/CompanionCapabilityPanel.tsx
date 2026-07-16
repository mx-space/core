import { AlertTriangle, RadioTower, RotateCcw } from 'lucide-react'

import type { CompanionCapabilities } from '~/api/companion'
import { useI18n } from '~/i18n'
import { Badge } from '~/ui/primitives/badge'
import { Button } from '~/ui/primitives/button'
import { Panel } from '~/ui/primitives/panel'

interface CompanionCapabilityPanelProps {
  capabilities?: CompanionCapabilities
  isError: boolean
  isLoading: boolean
  onRetry: () => void
}

export function CompanionCapabilityPanel(props: CompanionCapabilityPanelProps) {
  const { format, t } = useI18n()

  return (
    <Panel
      className="overflow-hidden border border-border bg-surface-card"
      description={t('companion.status.description')}
      title={t('companion.status.title')}
    >
      {props.isLoading ? (
        <div
          aria-label={t('companion.status.loading')}
          className="grid animate-pulse gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4"
          role="status"
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="h-16 rounded-sm bg-surface-inset" key={index} />
          ))}
        </div>
      ) : props.isError || !props.capabilities ? (
        <div
          className="flex items-center justify-between gap-4 p-4"
          role="alert"
        >
          <div className="flex min-w-0 items-start gap-3">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
            />
            <p className="text-sm text-fg-muted">
              {t('companion.status.loadFailed')}
            </p>
          </div>
          <Button onClick={props.onRetry} type="button" variant="secondary">
            <RotateCcw aria-hidden="true" className="size-3.5" />
            {t('companion.action.retry')}
          </Button>
        </div>
      ) : (
        <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-surface-card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-fg-muted">
                {t('companion.status.liveDesk')}
              </span>
              <RadioTower
                aria-hidden="true"
                className="size-4 text-fg-subtle"
              />
            </div>
            <Badge
              data-testid="companion-live-desk-status"
              tone={
                props.capabilities.features.liveDesk ? 'success' : 'warning'
              }
            >
              {props.capabilities.features.liveDesk
                ? t('companion.status.enabled')
                : t('companion.status.disabled')}
            </Badge>
          </div>
          <div className="bg-surface-card p-4">
            <div className="text-xs font-medium text-fg-muted">
              {t('companion.status.minimumClient')}
            </div>
            <div className="mt-3 font-mono text-sm font-semibold text-fg">
              v{props.capabilities.minimumClientVersion}
            </div>
          </div>
          <div className="bg-surface-card p-4">
            <div className="text-xs font-medium text-fg-muted">
              {t('companion.status.presenceSchema')}
            </div>
            <div className="mt-3 font-mono text-sm font-semibold text-fg">
              {props.capabilities.presenceSchemaVersions
                .map((version) => `v${version}`)
                .join(', ')}
            </div>
          </div>
          <div className="bg-surface-card p-4">
            <div className="text-xs font-medium text-fg-muted">
              {t('companion.status.heartbeat')}
            </div>
            <div className="mt-3 text-sm font-semibold text-fg">
              {t('companion.status.seconds', {
                count: format.number(
                  props.capabilities.limits.recommendedHeartbeatSeconds,
                ),
              })}
            </div>
          </div>
        </div>
      )}
    </Panel>
  )
}
