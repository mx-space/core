import type { LucideIcon } from 'lucide-react'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'

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
