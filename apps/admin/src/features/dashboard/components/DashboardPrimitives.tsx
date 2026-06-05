import type { LucideIcon } from 'lucide-react'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { cn } from '~/utils/cn'

import { formatNumber } from '../utils/dashboard'

export function EmptyDashboardBlock() {
  const { t } = useI18n()
  return (
    <div className="flex min-h-32 items-center justify-center text-sm text-fg-muted">
      {t('dashboard.empty')}
    </div>
  )
}

export function LiveCard(props: {
  icon: LucideIcon
  label: string
  live?: boolean
  value: number | string
}) {
  const Icon = props.icon

  return (
    <div className="bg-surface-card p-4">
      <div className="flex items-center gap-4">
        <div className="relative">
          {props.live ? (
            <span className="absolute -right-1 -top-1 flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-green-500" />
            </span>
          ) : null}
          <Icon className="size-5 text-fg-subtle" />
        </div>
        <div>
          <div className="text-xl font-semibold tabular-nums text-fg">
            {formatNumber(props.value)}
          </div>
          <div className="text-sm text-fg-muted">{props.label}</div>
        </div>
      </div>
    </div>
  )
}

export function StatCell(props: {
  icon: LucideIcon
  label: string
  onClick?: () => void
  value: number | string
}) {
  const Icon = props.icon

  return (
    <button
      className={cn(
        'bg-surface-card p-4 text-left',
        props.onClick && 'transition-colors hover:bg-surface-inset',
      )}
      disabled={!props.onClick}
      onClick={props.onClick}
      type="button"
    >
      <Icon className="mb-3 size-4 text-fg-subtle" />
      <div className="text-xs text-fg-muted">{props.label}</div>
      <div className="mt-1 text-lg font-medium tabular-nums text-fg">
        {formatNumber(props.value)}
      </div>
    </button>
  )
}

export function MaintenanceCard(props: {
  disabled?: boolean
  icon: LucideIcon
  label: string
  onClick: () => void
  value: string
}) {
  const { t } = useI18n()
  const Icon = props.icon

  return (
    <div className="bg-surface-card p-4">
      <Icon className="mb-3 size-5 text-fg-subtle" />
      <div className="text-sm text-fg-muted">{props.label}</div>
      <div className="mt-1 text-lg font-semibold text-fg">{props.value}</div>
      <Button
        className="mt-3"
        disabled={props.disabled}
        onClick={props.onClick}
        type="button"
        variant="subtle"
      >
        {t('dashboard.maintenance.clear')}
      </Button>
    </div>
  )
}
