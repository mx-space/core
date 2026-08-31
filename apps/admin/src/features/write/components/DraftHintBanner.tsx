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
  onDelete?: () => void
  onDismiss?: () => void
  onSecondaryAction?: () => void
  secondaryActionLabel?: string
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
    cardClass: 'bg-surface-card border-border',
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
        'flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 sm:gap-3',
        cardClass,
      )}
      role={props.variant === 'recovery' ? 'alert' : 'status'}
    >
      <Icon aria-hidden="true" className={cn('size-4 shrink-0', iconClass)} />
      <span
        className={cn(
          'min-w-0 flex-1 text-sm max-sm:basis-[calc(100%-2rem)]',
          props.variant === 'recovery'
            ? 'text-amber-900 dark:text-amber-100'
            : 'text-fg',
        )}
      >
        {props.message}
      </span>
      <div className="flex shrink-0 flex-wrap items-center gap-1 max-sm:w-full max-sm:pl-6">
        <Button
          className="h-7 px-2.5 text-xs"
          onClick={props.onAction}
          type="button"
          variant={actionVariant}
        >
          {props.actionLabel}
        </Button>
        {props.onSecondaryAction && props.secondaryActionLabel ? (
          <Button
            className="h-7 px-2.5 text-xs"
            onClick={props.onSecondaryAction}
            type="button"
            variant="secondary"
          >
            {props.secondaryActionLabel}
          </Button>
        ) : null}
        {props.onDelete ? (
          <Button
            className="h-7 px-2.5 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            onClick={props.onDelete}
            type="button"
            variant="ghost"
          >
            {t('write.recovery.deleteAction')}
          </Button>
        ) : null}
        {props.onDismiss ? (
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
        ) : null}
      </div>
    </div>
  )
}
