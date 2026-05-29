import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { PortalLayerScope, useFloatingZ } from '~/ui/feedback/portal-layer'
import { cn } from '~/utils/cn'

type DrawerSide = 'left' | 'right'

const SPRING = { duration: 0.32, ease: [0.32, 0.72, 0, 1] as const }
const FADE = { duration: 0.2, ease: 'easeOut' as const }

export function Drawer(props: {
  bodyClassName?: string
  children: ReactNode
  className?: string
  footer?: ReactNode
  headerActions?: ReactNode
  icon?: LucideIcon
  onClose: () => void
  open: boolean
  side?: DrawerSide
  title: ReactNode
  widthClassName?: string
}) {
  const { t } = useI18n()
  const side: DrawerSide = props.side ?? 'right'
  const Icon = props.icon
  const widthClassName = props.widthClassName ?? 'w-[min(90vw,28.125rem)]'
  const titleId = useId()
  const offClosed = side === 'right' ? '100%' : '-100%'
  const { z, depth } = useFloatingZ('drawer')

  useEffect(() => {
    if (!props.open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        props.onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [props.open, props.onClose])

  useEffect(() => {
    if (!props.open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [props.open])

  if (typeof document === 'undefined') return null

  return createPortal(
    <PortalLayerScope depth={depth}>
      <AnimatePresence>
        {props.open ? (
          <motion.div
            aria-hidden={false}
            className="fixed inset-0"
            style={{ zIndex: z }}
            initial="closed"
            animate="open"
            exit="closed"
          >
            <motion.div
              aria-hidden="true"
              className="absolute inset-0 bg-black/35"
              onClick={props.onClose}
              variants={{ closed: { opacity: 0 }, open: { opacity: 1 } }}
              transition={FADE}
            />
            <motion.div
              aria-labelledby={titleId}
              aria-modal="true"
              className={cn(
                'outline-hidden absolute bottom-0 top-0 flex flex-col bg-white dark:bg-neutral-950',
                side === 'right'
                  ? 'right-0 border-l border-neutral-200 shadow-[-12px_0_32px_-8px_rgba(15,23,42,0.18),-2px_0_8px_-2px_rgba(15,23,42,0.08)] dark:border-neutral-800 dark:shadow-[-16px_0_40px_-8px_rgba(0,0,0,0.6),-2px_0_8px_-2px_rgba(0,0,0,0.4)]'
                  : 'left-0 border-r border-neutral-200 shadow-[12px_0_32px_-8px_rgba(15,23,42,0.18),2px_0_8px_-2px_rgba(15,23,42,0.08)] dark:border-neutral-800 dark:shadow-[16px_0_40px_-8px_rgba(0,0,0,0.6),2px_0_8px_-2px_rgba(0,0,0,0.4)]',
                widthClassName,
                props.className,
              )}
              role="dialog"
              variants={{
                closed: { x: offClosed, opacity: 0 },
                open: { x: 0, opacity: 1 },
              }}
              transition={SPRING}
            >
              <div
                className={cn(
                  'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 dark:border-neutral-800 dark:bg-neutral-950',
                  APP_SHELL_HEADER_HEIGHT_CLASS,
                )}
              >
                <h2
                  className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-neutral-950 dark:text-neutral-50"
                  id={titleId}
                >
                  {Icon ? (
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                  ) : null}
                  <span className="truncate">{props.title}</span>
                </h2>
                <div className="flex shrink-0 items-center gap-1.5">
                  {props.headerActions}
                  <button
                    aria-label={t('ui.modal.closeAria')}
                    className="inline-flex size-9 items-center justify-center rounded text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-900 dark:hover:text-neutral-200"
                    onClick={props.onClose}
                    type="button"
                  >
                    <X aria-hidden="true" className="size-4" />
                  </button>
                </div>
              </div>
              <div
                className={cn(
                  'flex min-h-0 flex-1 flex-col',
                  props.bodyClassName,
                )}
              >
                {props.children}
              </div>
              {props.footer ? (
                <div className="flex shrink-0 items-center justify-end gap-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
                  {props.footer}
                </div>
              ) : null}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </PortalLayerScope>,
    document.body,
  )
}
