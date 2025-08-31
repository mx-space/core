import * as SwitchPrimitives from '@radix-ui/react-switch'
import type { HTMLMotionProps } from 'motion/react'
import { m as motion } from 'motion/react'
import * as React from 'react'

import { cn } from '~/lib/cn'

type SwitchProps = React.ComponentProps<typeof SwitchPrimitives.Root> &
  HTMLMotionProps<'button'> & {
    leftIcon?: React.ReactNode
    rightIcon?: React.ReactNode
    thumbIcon?: React.ReactNode
  }

function Switch({
  className,
  leftIcon,
  rightIcon,
  thumbIcon,
  onCheckedChange,
  ...props
}: SwitchProps) {
  const [isChecked, setIsChecked] = React.useState(
    props?.checked ?? props?.defaultChecked ?? false,
  )
  const [isTapped, setIsTapped] = React.useState(false)

  React.useEffect(() => {
    if (props?.checked !== undefined) setIsChecked(props.checked)
  }, [props?.checked])

  const handleCheckedChange = React.useCallback(
    (checked: boolean) => {
      setIsChecked(checked)
      onCheckedChange?.(checked)
    },
    [onCheckedChange],
  )

  return (
    <SwitchPrimitives.Root
      {...props}
      onCheckedChange={handleCheckedChange}
      asChild
    >
      <motion.button
        data-slot="switch"
        className={cn(
          'relative flex p-[3px] h-6 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-accent data-[state=unchecked]:bg-fill data-[state=checked]:justify-end data-[state=unchecked]:justify-start',
          className,
        )}
        whileTap="tap"
        initial={false}
        onTapStart={() => setIsTapped(true)}
        onTapCancel={() => setIsTapped(false)}
        onTap={() => setIsTapped(false)}
        {...props}
      >
        {leftIcon && (
          <motion.div
            data-slot="switch-left-icon"
            animate={
              isChecked ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }
            }
            transition={{ type: 'spring', bounce: 0 }}
            className="absolute [&_svg]:size-3 left-1 top-1/2 -translate-y-1/2 text-text-secondary"
          >
            {typeof leftIcon !== 'string' ? leftIcon : null}
          </motion.div>
        )}

        {rightIcon && (
          <motion.div
            data-slot="switch-right-icon"
            animate={
              isChecked ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }
            }
            transition={{ type: 'spring', bounce: 0 }}
            className="absolute [&_svg]:size-3 right-1 top-1/2 -translate-y-1/2 text-text-secondary"
          >
            {typeof rightIcon !== 'string' ? rightIcon : null}
          </motion.div>
        )}

        <SwitchPrimitives.Thumb asChild>
          <motion.div
            data-slot="switch-thumb"
            whileTap="tab"
            className={cn(
              'relative z-[1] [&_svg]:size-3 flex items-center justify-center rounded-full bg-background shadow-lg ring-0 text-text-secondary',
            )}
            layout
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            style={{
              width: 18,
              height: 18,
            }}
            animate={
              isTapped
                ? { width: 21, transition: { duration: 0.1 } }
                : { width: 18, transition: { duration: 0.1 } }
            }
          >
            {thumbIcon && typeof thumbIcon !== 'string' ? thumbIcon : null}
          </motion.div>
        </SwitchPrimitives.Thumb>
      </motion.button>
    </SwitchPrimitives.Root>
  )
}

export { Switch, type SwitchProps }
