import type { LucideIcon } from 'lucide-react'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'

import { formatNumber } from '../utils/dashboard'

export function ActionCard(props: {
  icon: LucideIcon
  label: string
  onManage: () => void
  onPrimary: () => void
  primaryLabel: string
  value: number | string
}) {
  const { t } = useI18n()
  const Icon = props.icon

  return (
    <div className="bg-white p-4 dark:bg-neutral-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-neutral-500">{props.label}</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">
            {formatNumber(props.value)}
          </div>
        </div>
        <Icon className="size-5 text-neutral-400" />
      </div>
      <div className="mt-3 flex gap-2">
        <Button onClick={props.onPrimary} type="button">
          {props.primaryLabel}
        </Button>
        <Button onClick={props.onManage} type="button" variant="subtle">
          {t('dashboard.action.manage')}
        </Button>
      </div>
    </div>
  )
}
