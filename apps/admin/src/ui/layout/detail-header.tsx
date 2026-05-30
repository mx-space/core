import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { HeaderBackButton } from '~/ui/layout/header-back-button'
import { cn } from '~/utils/cn'

export interface DetailHeaderProps {
  title?: ReactNode
  icon?: LucideIcon
  /** Icon 之额外 className（如 animate-spin、status 染色） */
  iconClassName?: string
  /** Title 下副行（meta、summary） */
  subtitle?: ReactNode
  actions?: ReactNode
  /**
   * Desktop 关 detail 之 X button 之 handler。传则显，未传则不显。
   * Mobile 总有 back button 经 `HeaderBackButton`，自调 `navigate(-1)`。
   */
  onClose?: () => void
  /** Mobile back 之自定义行为（默认 `navigate(-1)`） */
  onBack?: () => void
  className?: string
}

/**
 * Master-detail 之 detail panel 共享 header。
 *
 * - Mobile (<lg)：左侧显 `HeaderBackButton`，触发 `onBack`（默认 `navigate(-1)`）
 * - Desktop (≥lg)：back button 隐；若传 `onClose`，右侧显 X 关 button
 * - Title、icon、actions 两端同
 */
export function DetailHeader(props: DetailHeaderProps) {
  const { t } = useI18n()
  const Icon = props.icon
  const hasContent =
    props.title != null ||
    props.subtitle != null ||
    props.actions != null ||
    props.onClose != null

  if (!hasContent) return null

  const hasSubtitle = props.subtitle != null

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-between gap-3 border-b border-border bg-surface-card px-4',
        APP_SHELL_HEADER_HEIGHT_CLASS,
        props.className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="contents lg:hidden">
          <HeaderBackButton onClick={props.onBack} />
        </span>
        {Icon ? (
          <Icon
            aria-hidden="true"
            className={cn('size-4 shrink-0', props.iconClassName)}
          />
        ) : null}
        {hasSubtitle ? (
          <div className="min-w-0 flex-1">
            <h2 className="flex min-w-0 items-center gap-2 truncate text-sm font-medium text-fg">
              {props.title}
            </h2>
            <p className="mt-0.5 truncate text-xs text-fg-muted">
              {props.subtitle}
            </p>
          </div>
        ) : props.title ? (
          <h2 className="inline-flex min-w-0 items-center gap-2 truncate text-sm font-medium text-fg">
            {props.title}
          </h2>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {props.actions}
        {props.onClose ? (
          <button
            aria-label={t('ui.modal.closeAria')}
            className="hidden size-9 items-center justify-center rounded-sm text-fg-subtle transition-colors hover:bg-surface-inset hover:text-fg lg:inline-flex"
            onClick={props.onClose}
            type="button"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
