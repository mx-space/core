import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'

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
  showHeader?: boolean
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
  const showHeader = props.showHeader ?? true

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
              aria-label={
                !showHeader && typeof props.title === 'string'
                  ? props.title
                  : undefined
              }
              aria-labelledby={showHeader ? titleId : undefined}
              aria-modal="true"
              className={cn(
                'outline-hidden shadow-lg absolute bottom-0 top-0 flex flex-col bg-surface-card',
                side === 'right' ? 'right-0' : 'left-0',
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
              {showHeader ? (
                <div
                  className={cn(
                    'flex shrink-0 items-center justify-between gap-3 border-b border-border bg-surface-card px-4',
                    APP_SHELL_HEADER_HEIGHT_CLASS,
                  )}
                >
                  <h2
                    className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-fg"
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
                      className="inline-flex size-9 items-center justify-center rounded-sm text-fg-subtle transition-colors hover:bg-surface-inset hover:text-fg"
                      onClick={props.onClose}
                      type="button"
                    >
                      <X aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                </div>
              ) : null}
              <div
                className={cn(
                  'flex min-h-0 flex-1 flex-col',
                  props.bodyClassName,
                )}
              >
                {props.children}
              </div>
              {props.footer ? (
                <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-3">
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
