'use client'

import * as AccordionPrimitive from '@radix-ui/react-accordion'
import type { HTMLMotionProps, Transition } from 'motion/react'
import { AnimatePresence, m as motion } from 'motion/react'
import * as React from 'react'

import { clsxm } from '~/lib/cn'
import { Spring } from '~/lib/spring'

type AccordionItemContextType = {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}

const AccordionItemContext = React.createContext<
  AccordionItemContextType | undefined
>(undefined)

const useAccordionItem = (): AccordionItemContextType => {
  const context = React.use(AccordionItemContext)
  if (!context) {
    throw new Error('useAccordionItem must be used within an AccordionItem')
  }
  return context
}

type AccordionProps = React.ComponentProps<typeof AccordionPrimitive.Root>

function Accordion(props: AccordionProps) {
  return <AccordionPrimitive.Root data-slot="accordion" {...props} />
}

type AccordionItemProps = React.ComponentProps<
  typeof AccordionPrimitive.Item
> & {
  children: React.ReactNode
}

function AccordionItem({ className, children, ...props }: AccordionItemProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <AccordionItemContext value={{ isOpen, setIsOpen }}>
      <AccordionPrimitive.Item
        data-slot="accordion-item"
        className={clsxm('border-border border-b', className)}
        {...props}
      >
        {children}
      </AccordionPrimitive.Item>
    </AccordionItemContext>
  )
}

type AccordionTriggerProps = React.ComponentProps<
  typeof AccordionPrimitive.Trigger
> & {
  transition?: Transition
  chevron?: boolean
}

function AccordionTrigger({
  ref,
  className,
  children,
  transition = Spring.presets.smooth,
  chevron = true,
  ...props
}: AccordionTriggerProps) {
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  React.useImperativeHandle(ref, () => triggerRef.current as HTMLButtonElement)
  const { isOpen, setIsOpen } = useAccordionItem()

  React.useEffect(() => {
    const node = triggerRef.current
    if (!node) return

    const observer = new MutationObserver((mutationsList) => {
      mutationsList.forEach((mutation) => {
        if (mutation.attributeName === 'data-state') {
          const currentState = node.dataset.state
          setIsOpen(currentState === 'open')
        }
      })
    })
    observer.observe(node, {
      attributes: true,
      attributeFilter: ['data-state'],
    })
    const initialState = node.dataset.state
    setIsOpen(initialState === 'open')
    return () => {
      observer.disconnect()
    }
  }, [setIsOpen])

  return (
    <AccordionPrimitive.Header data-slot="accordion-header" className="flex">
      <AccordionPrimitive.Trigger
        ref={triggerRef}
        data-slot="accordion-trigger"
        className={clsxm(
          'flex flex-1 items-center justify-between py-4 text-start font-medium hover:underline',
          className,
        )}
        {...props}
      >
        {children}

        {chevron && (
          <motion.div
            data-slot="accordion-trigger-chevron"
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={transition}
          >
            <i className="text-text-secondary i-mingcute-down-line size-4 shrink-0" />
          </motion.div>
        )}
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

type AccordionContentProps = React.ComponentProps<
  typeof AccordionPrimitive.Content
> &
  HTMLMotionProps<'div'> & {
    transition?: Transition
  }

function AccordionContent({
  className,
  children,
  transition = Spring.presets.snappy,
  ...props
}: AccordionContentProps) {
  const { isOpen } = useAccordionItem()

  return (
    <AnimatePresence>
      {isOpen && (
        <AccordionPrimitive.Content forceMount {...props}>
          <motion.div
            key="accordion-content"
            data-slot="accordion-content"
            initial={{ height: 0, opacity: 0, '--mask-stop': '0%' }}
            animate={{ height: 'auto', opacity: 1, '--mask-stop': '100%' }}
            exit={{ height: 0, opacity: 0, '--mask-stop': '0%' }}
            transition={transition}
            style={{
              maskImage:
                'linear-gradient(black var(--mask-stop), transparent var(--mask-stop))',
              WebkitMaskImage:
                'linear-gradient(black var(--mask-stop), transparent var(--mask-stop))',
            }}
            className="overflow-hidden"
            {...props}
          >
            <div className={clsxm('pt-0 pb-4 text-sm', className)}>
              {children}
            </div>
          </motion.div>
        </AccordionPrimitive.Content>
      )}
    </AnimatePresence>
  )
}

export {
  Accordion,
  AccordionContent,
  type AccordionContentProps,
  AccordionItem,
  type AccordionItemContextType,
  type AccordionItemProps,
  type AccordionProps,
  AccordionTrigger,
  type AccordionTriggerProps,
}
