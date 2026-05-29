import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { PortalLayerScope, useFloatingZ } from '~/ui/feedback/portal-layer'
import { cn } from '~/utils/cn'

export type BottomSheetSnap = 'half' | 'full'

export interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  icon?: LucideIcon
  headerActions?: ReactNode
  footer?: ReactNode
  children: ReactNode
  bodyClassName?: string
  className?: string
  defaultSnap?: BottomSheetSnap
  snap?: BottomSheetSnap
  onSnapChange?: (snap: BottomSheetSnap) => void
}

const SPRING = { duration: 0.32, ease: [0.32, 0.72, 0, 1] as const }
const FADE = { duration: 0.2, ease: 'easeOut' as const }

const SNAP_HEIGHT: Record<BottomSheetSnap, string> = {
  half: '60vh',
  full: '95vh',
}

export function BottomSheet(props: BottomSheetProps) {
  const { t } = useI18n()
  const Icon = props.icon
  const titleId = useId()
  // BottomSheet shares the drawer tier intentionally (sibling overlay system)
  const { z, depth } = useFloatingZ('drawer')
  const [internalSnap, setInternalSnap] = useState<BottomSheetSnap>(
    props.defaultSnap ?? 'half',
  )
  const isControlled = props.snap !== undefined
  const snap = props.snap ?? internalSnap

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

  // Shares Drawer's limitation: nested overlays clobber each other's scroll restoration; shared useBodyScrollLock ref-count is a future cleanup
  useEffect(() => {
    if (!props.open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [props.open])

  if (typeof document === 'undefined') return null

  const toggleSnap = () => {
    const next: BottomSheetSnap = snap === 'half' ? 'full' : 'half'
    if (!isControlled) setInternalSnap(next)
    props.onSnapChange?.(next)
  }

  const ToggleIcon = snap === 'half' ? ChevronUp : ChevronDown

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
              data-testid="bottom-sheet-scrim"
              onClick={props.onClose}
              variants={{ closed: { opacity: 0 }, open: { opacity: 1 } }}
              transition={FADE}
            />
            <motion.div
              aria-labelledby={props.title ? titleId : undefined}
              aria-modal="true"
              className={cn(
                'outline-hidden absolute inset-x-0 bottom-0 flex flex-col rounded-t-2xl bg-white shadow-[0_-12px_32px_-8px_rgba(15,23,42,0.18),0_-2px_8px_-2px_rgba(15,23,42,0.08)] dark:bg-neutral-950 dark:shadow-[0_-16px_40px_-8px_rgba(0,0,0,0.6),0_-2px_8px_-2px_rgba(0,0,0,0.4)]',
                props.className,
              )}
              role="dialog"
              style={{ height: SNAP_HEIGHT[snap] }}
              variants={{
                closed: { y: '100%', opacity: 0 },
                open: { y: 0, opacity: 1 },
              }}
              transition={SPRING}
            >
              <div
                aria-hidden="true"
                className="flex shrink-0 items-center justify-center pt-2"
              >
                <div className="h-[3px] w-8 rounded bg-neutral-300 dark:bg-neutral-700" />
              </div>
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
                  {props.title ? (
                    <span className="truncate">{props.title}</span>
                  ) : null}
                </h2>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    aria-label={
                      snap === 'half'
                        ? t('ui.bottomSheet.expand')
                        : t('ui.bottomSheet.collapse')
                    }
                    className="inline-flex size-9 items-center justify-center rounded text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-900 dark:hover:text-neutral-200"
                    onClick={toggleSnap}
                    type="button"
                  >
                    <ToggleIcon aria-hidden="true" className="size-4" />
                  </button>
                  {props.headerActions}
                  <button
                    aria-label={t('ui.bottomSheet.closeAria')}
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
