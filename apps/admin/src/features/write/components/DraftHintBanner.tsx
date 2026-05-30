import type { LucideIcon } from 'lucide-react'
import { AlertCircle, History, X } from 'lucide-react'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
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
  {
    icon: LucideIcon
    cardClass: string
    iconClass: string
    actionVariant: 'primary' | 'secondary'
    dismissClass: string
  }
> = {
  list: {
    icon: History,
    cardClass: 'bg-surface-inset border-border',
    iconClass: 'text-fg-muted',
    actionVariant: 'secondary',
    dismissClass:
      'text-fg-subtle hover:bg-black/[0.06] hover:text-fg dark:hover:bg-white/[0.08]',
  },
  recovery: {
    icon: AlertCircle,
    cardClass:
      'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/40',
    iconClass: 'text-amber-600 dark:text-amber-400',
    actionVariant: 'primary',
    dismissClass:
      'text-amber-700/70 hover:bg-amber-100 hover:text-amber-900 dark:text-amber-300/70 dark:hover:bg-amber-900/40 dark:hover:text-amber-200',
  },
}

export function DraftHintBanner(props: DraftHintBannerProps) {
  const {
    icon: Icon,
    cardClass,
    iconClass,
    actionVariant,
    dismissClass,
  } = variantConfig[props.variant]
  const { t } = useI18n()

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2',
        cardClass,
      )}
      role={props.variant === 'recovery' ? 'alert' : 'status'}
    >
      <Icon aria-hidden="true" className={cn('size-4 shrink-0', iconClass)} />
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-sm',
          props.variant === 'recovery'
            ? 'text-amber-900 dark:text-amber-100'
            : 'text-fg',
        )}
      >
        {props.message}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          className="h-7 px-2.5 text-xs"
          onClick={props.onAction}
          type="button"
          variant={actionVariant}
        >
          {props.actionLabel}
        </Button>
        <button
          aria-label={t('write.draftHint.dismissAria')}
          className={cn(
            'inline-flex size-7 items-center justify-center rounded-sm transition-colors focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15',
            dismissClass,
          )}
          onClick={props.onDismiss}
          type="button"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
