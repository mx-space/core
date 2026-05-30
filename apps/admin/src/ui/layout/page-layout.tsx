import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect } from 'react'

import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { HeaderBackButton } from '~/ui/layout/header-back-button'
import { MobileHamburger } from '~/ui/layout/mobile-hamburger'
import { useShellNav } from '~/ui/layout/shell-nav-context'
import { cn } from '~/utils/cn'

export function AppPage(props: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        'flex h-full min-h-0 flex-col bg-background',
        props.className,
      )}
    >
      {props.children}
    </section>
  )
}

export interface PageHeaderBackProp {
  label?: string
  onClick?: () => void
  to?: string
}

export type HeaderAction =
  | {
      kind: 'button'
      icon: LucideIcon
      label: string
      onClick: () => void
      primary?: boolean
      disabled?: boolean
      iconOnly?: boolean
    }
  | {
      kind: 'custom'
      node: ReactNode
      mobileNode?: ReactNode
    }

interface PageHeaderProps {
  actions?: ReactNode | HeaderAction[]
  back?: PageHeaderBackProp
  className?: string
  count?: ReactNode
  description?: ReactNode
  icon?: ReactNode
  title: ReactNode
}

export function isHeaderActionArray(
  actions: PageHeaderProps['actions'],
): actions is HeaderAction[] {
  if (!Array.isArray(actions) || actions.length === 0) return false
  return actions.every(
    (item) =>
      item != null &&
      typeof item === 'object' &&
      'kind' in item &&
      (item.kind === 'button' || item.kind === 'custom'),
  )
}

export function PageHeader(props: PageHeaderProps) {
  const typedActions = isHeaderActionArray(props.actions) ? props.actions : null
  const hasActions =
    typedActions !== null ||
    (props.actions !== undefined &&
      props.actions !== null &&
      !(Array.isArray(props.actions) && props.actions.length === 0))

  const shellNav = useShellNav()
  const registerPageHeader = shellNav?.registerPageHeader
  useEffect(() => registerPageHeader?.(), [registerPageHeader])

  return (
    <header
      className={cn(
        'flex shrink-0 items-center justify-between gap-3 border-b border-border bg-surface-page px-4',
        APP_SHELL_HEADER_HEIGHT_CLASS,
        props.className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <MobileHamburger />
        {props.back ? <HeaderBackButton {...props.back} /> : null}
        {props.icon ? (
          <span className="inline-flex size-6 shrink-0 items-center justify-center border border-border bg-surface-inset text-fg-muted">
            {props.icon}
          </span>
        ) : null}
        <div className="flex min-w-0 flex-col">
          <div className="flex min-w-0 items-baseline gap-2">
            <h1 className="truncate text-base font-semibold text-fg">
              {props.title}
            </h1>
            {props.count != null ? (
              <span className="shrink-0 text-xs tabular-nums text-fg-muted">
                {props.count}
              </span>
            ) : null}
          </div>
          {props.description ? (
            <p className="mt-0.5 truncate text-xs text-fg-muted">
              {props.description}
            </p>
          ) : null}
        </div>
      </div>
      {hasActions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {typedActions
            ? typedActions.map((action, index) =>
                renderHeaderAction(action, index),
              )
            : (props.actions as ReactNode)}
        </div>
      ) : null}
    </header>
  )
}

export function HeaderActions(props: {
  actions: HeaderAction[]
  className?: string
}) {
  if (!props.actions.length) return null
  return (
    <div
      className={cn(
        'flex shrink-0 flex-wrap items-center gap-2',
        props.className,
      )}
    >
      {props.actions.map((action, index) => renderHeaderAction(action, index))}
    </div>
  )
}

function renderHeaderAction(action: HeaderAction, index: number) {
  if (action.kind === 'custom') {
    return (
      <span key={index} className="contents">
        <span className="hidden lg:contents">{action.node}</span>
        <span className="contents lg:hidden">
          {action.mobileNode ?? action.node}
        </span>
      </span>
    )
  }

  const Icon = action.icon
  const baseClasses =
    'focus-visible:outline-hidden inline-flex items-center justify-center rounded-sm text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-50'
  const primaryClasses = 'shadow-xs bg-accent text-white hover:bg-accent-hover'
  const secondaryClasses =
    'shadow-xs border border-border bg-surface-card text-fg hover:bg-surface-inset'
  const variantClasses = action.primary ? primaryClasses : secondaryClasses

  if (action.iconOnly) {
    return (
      <span key={index} className="contents">
        <button
          aria-label={action.label}
          className={cn(baseClasses, variantClasses, 'size-8')}
          disabled={action.disabled}
          onClick={action.onClick}
          title={action.label}
          type="button"
        >
          <Icon aria-hidden="true" className="size-3.5" />
        </button>
      </span>
    )
  }

  return (
    <span key={index} className="contents">
      <button
        aria-label={action.label}
        className={cn(baseClasses, variantClasses, 'size-8 lg:hidden')}
        disabled={action.disabled}
        onClick={action.onClick}
        title={action.label}
        type="button"
      >
        <Icon aria-hidden="true" className="size-3.5" />
      </button>
      <button
        aria-label={action.label}
        className={cn(
          baseClasses,
          variantClasses,
          'hidden h-8 gap-1.5 px-2.5 lg:inline-flex',
        )}
        disabled={action.disabled}
        onClick={action.onClick}
        type="button"
      >
        <Icon aria-hidden="true" className="size-3.5" />
        <span>{action.label}</span>
      </button>
    </span>
  )
}
