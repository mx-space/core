// Tremor Input [v2.0.0]

import { RiEyeFill, RiEyeOffFill, RiSearchLine } from '@remixicon/react'
import * as React from 'react'
import type { VariantProps } from 'tailwind-variants'
import { tv } from 'tailwind-variants'

import { clsxm, focusInput, focusRing, hasErrorInput } from '~/lib/cn'

const inputStyles = tv({
  base: [
    // base
    'relative block w-full appearance-none rounded-md border px-2.5 py-2 shadow-xs outline-hidden transition sm:text-sm',
    // border color
    'border-border',
    // text color
    'text-text',
    // placeholder color
    'placeholder:text-placeholder-text',
    // background color
    'bg-background',
    // disabled
    'disabled:border-border disabled:bg-disabled-control disabled:text-disabled-text',

    // file
    [
      'file:-my-2 file:-ml-2.5 file:cursor-pointer file:rounded-l-[5px] file:rounded-r-none file:border-0 file:px-3 file:py-2 file:outline-hidden focus:outline-hidden disabled:pointer-events-none file:disabled:pointer-events-none',
      'file:border-solid file:border-border file:bg-fill file:text-placeholder-text file:hover:bg-fill-secondary',
      'file:[border-inline-end-width:1px] file:[margin-inline-end:0.75rem]',
      'file:disabled:bg-disabled-control file:disabled:text-disabled-text',
    ],
    // focus
    focusInput,
    // invalid (optional)
    'aria-invalid:ring-2 aria-invalid:ring-red/20 aria-invalid:border-red invalid:ring-2 invalid:ring-red/20 invalid:border-red',
    // remove search cancel button (optional)
    '[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden',
  ],
  variants: {
    hasError: {
      true: hasErrorInput,
    },
    // number input
    enableStepper: {
      false:
        '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
    },
  },
})

interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputStyles> {
  inputClassName?: string
}

const Input = ({
  ref: forwardedRef,
  className,
  inputClassName,
  hasError,
  enableStepper = true,
  type,
  ...props
}: InputProps & { ref?: React.RefObject<HTMLInputElement | null> }) => {
  const [typeState, setTypeState] = React.useState(type)

  const isPassword = type === 'password'
  const isSearch = type === 'search'

  return (
    <div className={clsxm('relative w-full', className)} tremor-id="tremor-raw">
      <input
        ref={forwardedRef}
        type={isPassword ? typeState : type}
        className={clsxm(
          inputStyles({ hasError, enableStepper }),
          {
            'pl-8': isSearch,
            'pr-10': isPassword,
          },
          inputClassName,
        )}
        {...props}
      />
      {isSearch && (
        <div
          className={clsxm(
            // base
            'pointer-events-none absolute bottom-0 left-2 flex h-full items-center justify-center',
            // text color
            'text-placeholder-text',
          )}
        >
          <RiSearchLine
            className="size-[1.125rem] shrink-0"
            aria-hidden="true"
          />
        </div>
      )}
      {isPassword && (
        <div
          className={clsxm(
            'absolute bottom-0 right-0 flex h-full items-center justify-center px-3',
          )}
        >
          <button
            aria-label="Change password visibility"
            className={clsxm(
              // base
              'h-fit w-fit rounded-xs outline-hidden transition-all',
              // text
              'text-placeholder-text',
              // hover
              'hover:text-text',
              focusRing,
            )}
            type="button"
            onClick={() => {
              setTypeState(typeState === 'password' ? 'text' : 'password')
            }}
          >
            <span className="sr-only">
              {typeState === 'password' ? 'Show password' : 'Hide password'}
            </span>
            {typeState === 'password' ? (
              <RiEyeFill aria-hidden="true" className="size-5 shrink-0" />
            ) : (
              <RiEyeOffFill aria-hidden="true" className="size-5 shrink-0" />
            )}
          </button>
        </div>
      )}
    </div>
  )
}

Input.displayName = 'Input'

export { Input, type InputProps }
