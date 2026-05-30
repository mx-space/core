import type { ButtonProps as BaseButtonProps } from '@base-ui/react/button'
import { Button as BaseButton } from '@base-ui/react/button'
import type { LinkProps } from 'react-router'
import { Link } from 'react-router'

import { cn } from '~/utils/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'subtle'

export interface ButtonProps extends Omit<BaseButtonProps, 'className'> {
  className?: string
  variant?: ButtonVariant
  /** Render as a square icon-only button. Drops horizontal padding + gap. */
  iconOnly?: boolean
}

export interface ButtonLinkProps extends Omit<LinkProps, 'className'> {
  className?: string
  variant?: ButtonVariant
  iconOnly?: boolean
}

// `subtle` retained as an alias of `secondary` for backward compatibility with
// existing consumers; remove after a sweep through call sites in a later PR.
const variantClassNames: Record<ButtonVariant, string> = {
  primary: 'shadow-xs bg-accent text-white hover:bg-accent-hover',
  secondary:
    'shadow-xs border border-border bg-surface-card text-fg hover:bg-surface-inset',
  ghost: 'bg-transparent text-fg-muted hover:bg-surface-inset hover:text-fg',
  subtle:
    'shadow-xs border border-border bg-surface-card text-fg hover:bg-surface-inset',
}

const buttonBaseClassName =
  'inline-flex items-center justify-center rounded-sm text-sm font-medium outline-hidden transition-colors focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15 disabled:pointer-events-none disabled:opacity-50'

const buttonTextClassName = 'h-9 gap-2 px-3'

// Icon-only buttons are square (aspect-square) with zero horizontal padding so
// the inner icon sits at its declared size (size-4 ≈ 16/36 ≈ 44%). Keeping h-9
// matches the text variant for inline alignment.
const buttonIconClassName = 'h-9 w-9 p-0 gap-0'

function composeClassName(
  iconOnly: boolean,
  variant: ButtonVariant,
  extra: string | undefined,
) {
  return cn(
    buttonBaseClassName,
    iconOnly ? buttonIconClassName : buttonTextClassName,
    variantClassNames[variant],
    extra,
  )
}

export function Button({
  className,
  iconOnly = false,
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <BaseButton
      className={composeClassName(iconOnly, variant, className)}
      {...props}
    />
  )
}

export function ButtonLink({
  className,
  iconOnly = false,
  variant = 'primary',
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={composeClassName(iconOnly, variant, className)}
      {...props}
    />
  )
}
