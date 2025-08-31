'use client'

import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import type { HTMLMotionProps } from 'motion/react'
import { m as motion } from 'motion/react'
import * as React from 'react'

import { clsxm } from '~/lib/cn'

type CheckboxProps = React.ComponentProps<typeof CheckboxPrimitive.Root> &
  HTMLMotionProps<'button'> & {
    indeterminate?: boolean
  }

function Checkbox({
  className,
  onCheckedChange,
  indeterminate,
  ...props
}: CheckboxProps) {
  const [isChecked, setIsChecked] = React.useState(
    props?.checked ?? props?.defaultChecked ?? false,
  )

  React.useEffect(() => {
    if (props?.checked !== undefined) setIsChecked(props.checked)
  }, [props?.checked])

  // Determine the actual state including indeterminate
  const checkboxState = indeterminate
    ? 'indeterminate'
    : isChecked
      ? 'checked'
      : 'unchecked'

  const handleCheckedChange = React.useCallback(
    (checked: boolean) => {
      setIsChecked(checked)
      onCheckedChange?.(checked)
    },
    [onCheckedChange],
  )

  return (
    <CheckboxPrimitive.Root
      {...props}
      onCheckedChange={handleCheckedChange}
      asChild
    >
      <motion.button
        data-slot="checkbox"
        className={clsxm(
          'peer size-5 flex items-center justify-center shrink-0 rounded-sm bg-fill transition-colors duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-accent data-[state=checked]:text-white',
          indeterminate && 'bg-accent text-white',
          className,
        )}
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: 1.05 }}
        {...props}
      >
        <CheckboxPrimitive.Indicator forceMount asChild>
          <motion.svg
            data-slot="checkbox-indicator"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="3.5"
            stroke="currentColor"
            className="size-3.5"
            initial="unchecked"
            animate={checkboxState}
          >
            {/* Checkmark path */}
            <motion.path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
              variants={{
                checked: {
                  pathLength: 1,
                  opacity: 1,
                  transition: {
                    duration: 0.2,
                    delay: 0.2,
                  },
                },
                unchecked: {
                  pathLength: 0,
                  opacity: 0,
                  transition: {
                    duration: 0.2,
                  },
                },
                indeterminate: {
                  pathLength: 0,
                  opacity: 0,
                  transition: {
                    duration: 0.1,
                  },
                },
              }}
            />
            {/* Indeterminate line */}
            <motion.path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 12h12"
              variants={{
                checked: {
                  pathLength: 0,
                  opacity: 0,
                  transition: {
                    duration: 0.1,
                  },
                },
                unchecked: {
                  pathLength: 0,
                  opacity: 0,
                  transition: {
                    duration: 0.1,
                  },
                },
                indeterminate: {
                  pathLength: 1,
                  opacity: 1,
                  transition: {
                    duration: 0.2,
                    delay: 0.1,
                  },
                },
              }}
            />
          </motion.svg>
        </CheckboxPrimitive.Indicator>
      </motion.button>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox, type CheckboxProps }
