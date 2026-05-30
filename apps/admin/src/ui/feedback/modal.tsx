import { Dialog } from '@base-ui/react/dialog'
import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import type { CSSProperties, ReactNode } from 'react'
import { useRef } from 'react'

import { useI18n } from '~/i18n'
import { PortalLayerScope, useFloatingZ } from '~/ui/feedback/portal-layer'
import { cn } from '~/utils/cn'

const POPUP_TRANSITION = {
  duration: 0.22,
  ease: [0.32, 0.72, 0, 1] as const,
}
const FADE_TRANSITION = { duration: 0.18, ease: 'easeOut' as const }

export interface ModalProps {
  children: ReactNode
  className?: string
  initialFocus?: Dialog.Popup.Props['initialFocus']
  onClose?: () => void
  onExitComplete?: () => void
  onOpenChange?: Dialog.Root.Props['onOpenChange']
  open: boolean
  popupStyle?: CSSProperties
}

/**
 * base-ui Dialog 包以 motion 过渡。
 * 外置 AnimatePresence 控 exit；actionsRef.unmount 延 unmount 至 exit 毕。
 */
export function Modal(props: ModalProps) {
  const { z, depth } = useFloatingZ('dialog')
  const actionsRef = useRef<Dialog.Root.Actions | null>(null)

  return (
    <Dialog.Root
      actionsRef={actionsRef}
      onOpenChange={(open, eventDetails) => {
        if (props.onOpenChange) {
          props.onOpenChange(open, eventDetails)
          if (eventDetails.isCanceled) return
        }
        if (!open) props.onClose?.()
      }}
      open={props.open}
    >
      <AnimatePresence
        onExitComplete={() => {
          actionsRef.current?.unmount()
          props.onExitComplete?.()
        }}
      >
        {props.open ? (
          <Dialog.Portal keepMounted>
            <Dialog.Backdrop
              className="fixed inset-0 bg-black/35"
              render={
                <motion.div
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                  transition={FADE_TRANSITION}
                />
              }
              style={{ zIndex: z - 1 }}
            />
            <Dialog.Popup
              className={cn(
                'outline-hidden shadow-lg fixed left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg bg-surface-card',
                props.className,
              )}
              initialFocus={props.initialFocus}
              render={
                <motion.div
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  initial={{ opacity: 0, scale: 0.96 }}
                  transition={POPUP_TRANSITION}
                />
              }
              style={{ ...props.popupStyle, zIndex: z }}
            >
              <PortalLayerScope depth={depth}>
                {props.children}
              </PortalLayerScope>
            </Dialog.Popup>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  )
}

export const ModalTitle = Dialog.Title
export const ModalDescription = Dialog.Description
export const ModalClose = Dialog.Close

/**
 * Modal header — h-14 with px-6 internal padding (matches DSv2 modal scale).
 * The close button uses `-mr-2.5` so its size-9 hit-box optically aligns with
 * the parent's px-6 right edge (size-9 wraps a size-4 icon with 10px gutters).
 */
export function ModalHeader(props: {
  actions?: ReactNode
  className?: string
  icon?: LucideIcon
  onClose?: () => void
  showClose?: boolean
  subtitle?: ReactNode
  title: ReactNode
}) {
  const { t } = useI18n()
  const Icon = props.icon
  const showClose = props.showClose ?? true
  return (
    <div
      className={cn(
        'flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-6',
        props.className,
      )}
    >
      <div className="min-w-0">
        <ModalTitle className="inline-flex min-w-0 items-center gap-2 text-lg font-semibold text-fg">
          {Icon ? (
            <Icon aria-hidden="true" className="size-4 shrink-0" />
          ) : null}
          <span className="truncate">{props.title}</span>
        </ModalTitle>
        {props.subtitle ? (
          <p className="mt-0.5 truncate text-xs text-fg-muted">
            {props.subtitle}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {props.actions}
        {showClose ? (
          <ModalClose
            aria-label={t('ui.modal.closeAria')}
            className="-mr-2.5 inline-flex size-9 items-center justify-center rounded-sm text-fg-subtle transition-colors hover:bg-surface-inset hover:text-fg"
          >
            <X aria-hidden="true" className="size-4" />
          </ModalClose>
        ) : null}
      </div>
    </div>
  )
}
