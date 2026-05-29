import { AlertCircle, History, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { useI18n } from '~/i18n'
import { cn } from '~/utils/cn'

interface DraftHintBannerProps {
  variant: 'list' | 'recovery'
  message: string
  actionLabel: string
  onAction: () => void
  onDismiss: () => void
}

const variantConfig: Record<
  DraftHintBannerProps['variant'],
  { icon: LucideIcon; iconClass: string }
> = {
  list: {
    icon: History,
    iconClass: 'text-neutral-500 dark:text-neutral-400',
  },
  recovery: {
    icon: AlertCircle,
    iconClass: 'text-amber-600 dark:text-amber-400',
  },
}

export function DraftHintBanner(props: DraftHintBannerProps) {
  const { icon: Icon, iconClass } = variantConfig[props.variant]
  const { t } = useI18n()

  return (
    <div
      className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50/70 py-2 pl-6 pr-4 dark:border-neutral-800 dark:bg-neutral-900/40"
      role="status"
    >
      <div className="flex min-w-0 items-center gap-2">
        <Icon aria-hidden="true" className={cn('size-4 shrink-0', iconClass)} />
        <span className="truncate text-sm text-neutral-700 dark:text-neutral-300">
          {props.message}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          className="inline-flex h-7 items-center rounded border border-neutral-200 bg-white px-2 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900"
          onClick={props.onAction}
          type="button"
        >
          {props.actionLabel}
        </button>
        <button
          aria-label={t('write.draftHint.dismissAria')}
          className="inline-flex size-7 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          onClick={props.onDismiss}
          type="button"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
