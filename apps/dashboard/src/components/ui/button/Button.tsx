// Tremor Button [v0.2.0]

import { Slot } from '@radix-ui/react-slot'
import * as React from 'react'
import type { VariantProps } from 'tailwind-variants'
import { tv } from 'tailwind-variants'

import { cx, focusRing } from '~/lib/cn'

const buttonVariants = tv({
  base: [
    // base - adjust border radius and spacing
    'relative inline-flex items-center justify-center whitespace-nowrap rounded-lg border text-center font-medium shadow-sm transition-all duration-200 ease-out',
    // disabled
    'disabled:pointer-events-none disabled:shadow-none disabled:text-disabled-text',
    // focus
    focusRing,
  ],
  variants: {
    variant: {
      primary: [
        // border
        '!border-transparent',
        // text color
        'text-background',
        'bg-accent',
        // hover state
        'hover:bg-accent/90',
        // active state
        'active:scale-[0.98]',
        'disabled:bg-disabled-control',
      ],
      secondary: [
        // border
        'border-border',
        // text color
        'text-text',
        // background color
        'bg-background',
        // hover color
        'hover:bg-fill-secondary hover:border-border shadow-none hover:shadow-sm',
        // active state
        'active:bg-fill-tertiary active:scale-[0.98]',
        // disabled
        'disabled:bg-fill disabled:text-disabled-text disabled:border-border',
        'disabled:bg-disabled-control',
      ],
      light: [
        // base
        'shadow-none',
        // border
        'border-transparent',
        // text color
        'text-text',
        // background color
        'bg-fill',
        // hover color
        'hover:bg-fill-tertiary hover:shadow-sm',
        // active state
        'active:bg-fill-quaternary active:scale-[0.98]',
        // disabled
        'disabled:bg-fill disabled:text-disabled-text',
      ],
      ghost: [
        // base
        'shadow-none',
        // border
        'border-transparent',
        // text color
        'text-text-secondary',
        // hover color
        'bg-transparent hover:bg-fill/80 hover:text-text',
        // active state
        'active:bg-fill active:scale-[0.98]',
        // disabled
        'disabled:text-disabled-text',
      ],
      destructive: [
        // text color
        'text-background',
        // border
        'border-transparent',
        // background color
        'bg-red',
        // hover color
        'hover:bg-red/90 hover:shadow-md',
        // active state
        'active:bg-red/80 active:scale-[0.98]',
        // disabled
        'disabled:bg-red/50 disabled:text-background/70',
      ],
    },
    size: {
      sm: ['px-3 py-1.5 text-xs rounded-md'],
      md: ['px-4 py-2 text-sm rounded-lg'],
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
})

interface ButtonProps
  extends React.ComponentPropsWithoutRef<'button'>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  isLoading?: boolean
  loadingText?: string
  size?: 'sm' | 'md'
}

const Button = ({
  ref: forwardedRef,
  asChild,
  isLoading = false,
  loadingText,
  className,
  disabled,
  variant,
  size = 'md',
  children,
  ...props
}: ButtonProps & { ref?: React.RefObject<HTMLButtonElement | null> }) => {
  const Component = asChild ? Slot : 'button'
  return (
    <Component
      ref={forwardedRef}
      className={cx(buttonVariants({ variant, size }), className)}
      disabled={disabled || isLoading}
      tremor-id="tremor-raw"
      {...props}
    >
      {isLoading ? (
        <span className="pointer-events-none flex shrink-0 items-center justify-center gap-1.5">
          <i
            className="size-4 shrink-0 animate-spin i-mingcute-loading-3-line"
            aria-hidden="true"
          />
          <span className="sr-only">{loadingText ?? 'Loading'}</span>
          {loadingText ?? children}
        </span>
      ) : (
        children
      )}
    </Component>
  )
}

Button.displayName = 'Button'

export { Button, type ButtonProps }
