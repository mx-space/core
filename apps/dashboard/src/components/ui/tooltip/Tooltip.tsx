'use client'

import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import type { Transition } from 'motion/react'
import { AnimatePresence, m } from 'motion/react'
import * as React from 'react'
import { useMemo } from 'react'

import { clsxm as cn } from '~/lib/cn'
import { Spring } from '~/lib/spring'

type TooltipContextType = {
  isOpen: boolean
}

const TooltipContext = React.createContext<TooltipContextType | undefined>(
  undefined,
)

const useTooltip = (): TooltipContextType => {
  const context = React.use(TooltipContext)
  if (!context) {
    throw new Error('useTooltip must be used within a Tooltip')
  }
  return context
}

type Side = 'top' | 'bottom' | 'left' | 'right'

const getInitialPosition = (side: Side) => {
  switch (side) {
    case 'top': {
      return { y: 15 }
    }
    case 'bottom': {
      return { y: -15 }
    }
    case 'left': {
      return { x: 15 }
    }
    case 'right': {
      return { x: -15 }
    }
  }
}

type TooltipProviderProps = React.ComponentProps<
  typeof TooltipPrimitive.Provider
>

function TooltipProvider(props: TooltipProviderProps) {
  // eslint-disable-next-line @eslint-react/no-context-provider
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" {...props} />
}

type TooltipProps = React.ComponentProps<typeof TooltipPrimitive.Root>

function Tooltip(props: TooltipProps) {
  const [isOpen, setIsOpen] = React.useState(
    props?.open ?? props?.defaultOpen ?? false,
  )

  React.useEffect(() => {
    if (props?.open !== undefined) setIsOpen(props.open)
  }, [props?.open])

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      setIsOpen(open)
      props.onOpenChange?.(open)
    },
    [props],
  )

  return (
    <TooltipProvider>
      <TooltipContext value={useMemo(() => ({ isOpen }), [isOpen])}>
        <TooltipPrimitive.Root
          data-slot="tooltip"
          {...props}
          onOpenChange={handleOpenChange}
        />
      </TooltipContext>
    </TooltipProvider>
  )
}

type TooltipTriggerProps = React.ComponentProps<typeof TooltipPrimitive.Trigger>

function TooltipTrigger(props: TooltipTriggerProps) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

type TooltipContentProps = React.ComponentProps<
  typeof TooltipPrimitive.Content
> & {
  transition?: Transition
  arrow?: boolean
}

function TooltipContent({
  className,
  side = 'top',
  sideOffset = 4,
  transition = Spring.presets.smooth,
  arrow = true,
  children,
  ...props
}: TooltipContentProps) {
  const { isOpen } = useTooltip()
  const initialPosition = getInitialPosition(side)

  return (
    <AnimatePresence>
      {isOpen && (
        <TooltipPrimitive.Portal forceMount data-slot="tooltip-portal">
          <TooltipPrimitive.Content
            forceMount
            sideOffset={sideOffset}
            className="z-50"
            {...props}
          >
            <m.div
              key="tooltip-content"
              data-slot="tooltip-content"
              initial={{ opacity: 0, scale: 0, ...initialPosition }}
              animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, scale: 0, ...initialPosition }}
              transition={transition}
              className={cn(
                'relative bg-background text-foreground shadow-md w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-sm text-balance',
                className,
              )}
            >
              {children}

              {arrow && (
                <TooltipPrimitive.Arrow
                  data-slot="tooltip-content-arrow"
                  className="bg-background fill-background z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px]"
                />
              )}
            </m.div>
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      )}
    </AnimatePresence>
  )
}

export {
  Tooltip,
  TooltipContent,
  type TooltipContentProps,
  type TooltipContextType,
  type TooltipProps,
  TooltipProvider,
  type TooltipProviderProps,
  TooltipTrigger,
  type TooltipTriggerProps,
  useTooltip,
}
