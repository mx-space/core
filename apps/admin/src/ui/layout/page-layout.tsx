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
        'flex h-full min-h-0 flex-col bg-white dark:bg-neutral-950',
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
  description?: ReactNode
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
        'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 dark:border-neutral-800 dark:bg-neutral-950',
        APP_SHELL_HEADER_HEIGHT_CLASS,
        props.className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <MobileHamburger />
        {props.back ? <HeaderBackButton {...props.back} /> : null}
        <div className="min-w-0">
          <h1 className="truncate text-sm font-medium text-neutral-950 dark:text-neutral-50">
            {props.title}
          </h1>
          {props.description ? (
            <p className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
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
    'focus-visible:outline-hidden inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-neutral-500 dark:focus-visible:ring-offset-neutral-900'
  const primaryClasses =
    'bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200'
  const secondaryClasses =
    'border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50 dark:hover:bg-neutral-900'
  const variantClasses = action.primary ? primaryClasses : secondaryClasses

  if (action.iconOnly) {
    return (
      <span key={index} className="contents">
        <button
          aria-label={action.label}
          className={cn(baseClasses, variantClasses, 'size-9')}
          disabled={action.disabled}
          onClick={action.onClick}
          title={action.label}
          type="button"
        >
          <Icon aria-hidden="true" className="size-4" />
        </button>
      </span>
    )
  }

  return (
    <span key={index} className="contents">
      <button
        aria-label={action.label}
        className={cn(baseClasses, variantClasses, 'size-9 lg:hidden')}
        disabled={action.disabled}
        onClick={action.onClick}
        title={action.label}
        type="button"
      >
        <Icon aria-hidden="true" className="size-4" />
      </button>
      <button
        aria-label={action.label}
        className={cn(
          baseClasses,
          variantClasses,
          'hidden h-9 gap-1.5 px-3 lg:inline-flex',
        )}
        disabled={action.disabled}
        onClick={action.onClick}
        type="button"
      >
        <Icon aria-hidden="true" className="size-4" />
        <span>{action.label}</span>
      </button>
    </span>
  )
}
