import { Button as BaseButton } from '@base-ui/react/button'
import { Link } from 'react-router'
import type { ButtonProps as BaseButtonProps } from '@base-ui/react/button'
import type { LinkProps } from 'react-router'

import { cn } from '~/utils/cn'

type ButtonVariant = 'primary' | 'subtle'

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

const variantClassNames: Record<ButtonVariant, string> = {
  primary:
    'bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-200',
  subtle:
    'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900',
}

const buttonBaseClassName =
  'inline-flex items-center justify-center rounded text-sm font-medium outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-primary-shallow)] disabled:pointer-events-none disabled:opacity-50'

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
