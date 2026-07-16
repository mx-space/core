import {
  AlertTriangle,
  AppWindow,
  Clock3,
  RadioTower,
  RotateCcw,
} from 'lucide-react'

import type { CompanionPublicPresenceResult } from '~/api/companion'
import { useI18n } from '~/i18n'
import { Badge, type BadgeTone } from '~/ui/primitives/badge'
import { Button } from '~/ui/primitives/button'
import { Panel } from '~/ui/primitives/panel'

type LiveDeskReportStatus = 'expired' | 'live' | 'no-report'

interface CompanionLiveDeskPanelProps {
  isError: boolean
  isLoading: boolean
  onRetry: () => void
  presence?: CompanionPublicPresenceResult
}

const statusTone: Record<LiveDeskReportStatus, BadgeTone> = {
  expired: 'warning',
  live: 'success',
  'no-report': 'neutral',
}

function getReportStatus(
  presence: CompanionPublicPresenceResult | undefined,
  now: number,
): LiveDeskReportStatus {
  const projection = presence?.state.projection

  if (projection && Date.parse(projection.expiresAt) > now) return 'live'
  if (!presence || presence.state.revision === 0) return 'no-report'

  return 'expired'
}

export function CompanionLiveDeskPanel(props: CompanionLiveDeskPanelProps) {
  const { t } = useI18n()

  return (
    <Panel
      className="overflow-hidden border border-border bg-surface-card"
      description={t('companion.liveDesk.description')}
      title={t('companion.liveDesk.title')}
    >
      {props.isLoading ? (
        <div
          aria-label={t('companion.liveDesk.loading')}
          className="grid animate-pulse gap-px bg-border sm:grid-cols-2 lg:grid-cols-4"
          role="status"
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="h-24 bg-surface-card p-4" key={index}>
              <div className="h-3 w-20 rounded-xs bg-surface-inset" />
              <div className="mt-4 h-5 w-28 rounded-xs bg-surface-inset" />
            </div>
          ))}
        </div>
      ) : props.isError ? (
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
              {t('companion.liveDesk.loadFailed')}
            </p>
          </div>
          <Button onClick={props.onRetry} type="button" variant="secondary">
            <RotateCcw aria-hidden="true" className="size-3.5" />
            {t('companion.action.retry')}
          </Button>
        </div>
      ) : (
        <LiveDeskReportDetails presence={props.presence} />
      )}
    </Panel>
  )
}

function LiveDeskReportDetails(props: {
  presence?: CompanionPublicPresenceResult
}) {
  const { format, t } = useI18n()
  const projection = props.presence?.state.projection ?? null
  const revision = props.presence?.state.revision ?? 0
  const status = getReportStatus(props.presence, Date.now())
  const application = projection?.application
  const applicationDetail =
    application?.activity?.customLabel ??
    application?.activity?.key ??
    application?.window?.title ??
    null
  const statusDescription =
    status === 'live'
      ? t('companion.liveDesk.liveDescription')
      : status === 'expired'
        ? t('companion.liveDesk.expiredDescription')
        : t('companion.liveDesk.noReportDescription')

  return (
    <div data-testid="companion-public-presence">
      <div className="flex flex-col gap-3 border-b border-border bg-surface-inset/50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-border bg-surface-card text-fg-muted">
            <RadioTower aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-fg">
                {t('companion.liveDesk.publicProjection')}
              </span>
              <Badge
                data-testid="companion-public-presence-status"
                tone={statusTone[status]}
              >
                {status === 'live'
                  ? t('companion.liveDesk.live')
                  : status === 'expired'
                    ? t('companion.liveDesk.expired')
                    : t('companion.liveDesk.noReport')}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-fg-muted">{statusDescription}</p>
          </div>
        </div>
        <div className="shrink-0 font-mono text-xs text-fg-muted">
          {t('companion.liveDesk.revision', {
            revision: format.number(revision),
          })}
        </div>
      </div>

      <dl className="grid gap-px bg-border sm:grid-cols-3">
        <div className="bg-surface-card p-4">
          <dt className="flex items-center gap-2 text-xs font-medium text-fg-muted">
            <AppWindow aria-hidden="true" className="size-3.5" />
            {t('companion.liveDesk.application')}
          </dt>
          <dd
            className="mt-3 truncate text-sm font-semibold text-fg"
            data-testid="companion-public-presence-application"
          >
            {application?.displayName ?? t('companion.liveDesk.notShared')}
          </dd>
          {applicationDetail ? (
            <div className="mt-1 truncate text-xs text-fg-muted">
              {applicationDetail}
            </div>
          ) : null}
        </div>
        <div className="bg-surface-card p-4">
          <dt className="flex items-center gap-2 text-xs font-medium text-fg-muted">
            <Clock3 aria-hidden="true" className="size-3.5" />
            {t('companion.liveDesk.updatedAt')}
          </dt>
          <dd
            className="mt-3 text-sm font-semibold text-fg"
            data-testid="companion-public-presence-updated-at"
            title={
              projection ? format.dateTime(projection.updatedAt) : undefined
            }
          >
            {projection
              ? format.relativeTime(projection.updatedAt)
              : t('companion.liveDesk.unavailable')}
          </dd>
        </div>
        <div className="bg-surface-card p-4">
          <dt className="flex items-center gap-2 text-xs font-medium text-fg-muted">
            <Clock3 aria-hidden="true" className="size-3.5" />
            {t('companion.liveDesk.expiresAt')}
          </dt>
          <dd
            className="mt-3 text-sm font-semibold text-fg"
            data-testid="companion-public-presence-expires-at"
            title={
              projection ? format.dateTime(projection.expiresAt) : undefined
            }
          >
            {projection
              ? format.relativeTime(projection.expiresAt)
              : t('companion.liveDesk.unavailable')}
          </dd>
        </div>
      </dl>
    </div>
  )
}
