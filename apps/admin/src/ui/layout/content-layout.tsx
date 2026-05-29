import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Panel, Group as PanelGroup, usePanelRef } from 'react-resizable-panels'
import type { BottomSheetSnap } from '~/ui/feedback/bottom-sheet'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { DESKTOP_MEDIA_QUERY, useMediaQuery } from '~/hooks/use-media-query'
import { useI18n } from '~/i18n'
import { BottomSheet } from '~/ui/feedback/bottom-sheet'
import { ResizeHandle } from '~/ui/layout/resize-handle'
import { cn } from '~/utils/cn'

const PANEL_FADE = { duration: 0.22, ease: 'easeOut' as const }

interface ContentLayoutContextValue {
  asideEl: HTMLDivElement | null
}

const ContentLayoutContext = createContext<ContentLayoutContextValue | null>(
  null,
)

export function ContentLayout(props: {
  asideDefaultSize?: number | string
  asideMaxSize?: number | string
  asideMinSize?: number | string
  asideMobileSnap?: BottomSheetSnap
  asideMobileTitle?: ReactNode
  children: ReactNode
  className?: string
  mainClassName?: string
  mainMinSize?: number | string
  onCloseAside?: () => void
  open: boolean
}) {
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY)
  const [asideEl, setAsideEl] = useState<HTMLDivElement | null>(null)

  const value = useMemo<ContentLayoutContextValue>(
    () => ({ asideEl }),
    [asideEl],
  )

  return (
    <ContentLayoutContext.Provider value={value}>
      {isDesktop ? (
        <DesktopContentLayout
          asideDefaultSize={props.asideDefaultSize}
          asideMaxSize={props.asideMaxSize}
          asideMinSize={props.asideMinSize}
          className={props.className}
          mainClassName={props.mainClassName}
          mainMinSize={props.mainMinSize}
          open={props.open}
          setAsideEl={setAsideEl}
        >
          {props.children}
        </DesktopContentLayout>
      ) : (
        <MobileContentLayout
          asideMobileSnap={props.asideMobileSnap}
          asideMobileTitle={props.asideMobileTitle}
          className={props.className}
          mainClassName={props.mainClassName}
          onCloseAside={props.onCloseAside}
          open={props.open}
          setAsideEl={setAsideEl}
        >
          {props.children}
        </MobileContentLayout>
      )}
    </ContentLayoutContext.Provider>
  )
}

function DesktopContentLayout(props: {
  asideDefaultSize?: number | string
  asideMaxSize?: number | string
  asideMinSize?: number | string
  children: ReactNode
  className?: string
  mainClassName?: string
  mainMinSize?: number | string
  open: boolean
  setAsideEl: (el: HTMLDivElement | null) => void
}) {
  const asideRef = usePanelRef()
  const [resizing, setResizing] = useState(false)

  useEffect(() => {
    const panel = asideRef.current
    if (!panel) return
    if (props.open && panel.isCollapsed()) {
      panel.expand()
    } else if (!props.open && !panel.isCollapsed()) {
      panel.collapse()
    }
  }, [props.open, asideRef])

  useEffect(() => {
    if (!resizing) return
    const stop = () => setResizing(false)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [resizing])

  return (
    <PanelGroup
      className={cn('flex min-h-0 min-w-0 flex-1', props.className)}
      data-content-layout=""
      data-resizing={resizing ? 'true' : 'false'}
      orientation="horizontal"
    >
      <Panel
        className={cn('min-h-0 min-w-0 overflow-hidden', props.mainClassName)}
        id="content-layout-main"
        minSize={props.mainMinSize ?? '40%'}
      >
        {props.children}
      </Panel>
      <ResizeHandle
        disabled={!props.open}
        onPointerDown={() => setResizing(true)}
      />
      <Panel
        className="min-h-0 overflow-hidden"
        collapsedSize={0}
        collapsible
        defaultSize={props.asideDefaultSize ?? '320px'}
        groupResizeBehavior="preserve-pixel-size"
        id="content-layout-aside"
        maxSize={props.asideMaxSize ?? '50%'}
        minSize={props.asideMinSize ?? '280px'}
        panelRef={asideRef}
      >
        <div
          className="relative h-full bg-white dark:bg-neutral-950"
          ref={props.setAsideEl}
        />
      </Panel>
    </PanelGroup>
  )
}

function MobileContentLayout(props: {
  asideMobileSnap?: BottomSheetSnap
  asideMobileTitle?: ReactNode
  children: ReactNode
  className?: string
  mainClassName?: string
  onCloseAside?: () => void
  open: boolean
  setAsideEl: (el: HTMLDivElement | null) => void
}) {
  const handleClose = () => {
    props.onCloseAside?.()
  }

  return (
    <>
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col',
          props.className,
          props.mainClassName,
        )}
        data-content-layout=""
        data-content-layout-mode="mobile"
      >
        {props.children}
      </div>
      <BottomSheet
        bodyClassName="relative bg-white dark:bg-neutral-950"
        defaultSnap={props.asideMobileSnap ?? 'half'}
        onClose={handleClose}
        open={props.open}
        title={props.asideMobileTitle}
      >
        <div className="relative h-full" ref={props.setAsideEl} />
      </BottomSheet>
    </>
  )
}

export function ContentLayoutSlot(props: {
  active: boolean
  children: ReactNode
  id: string
}) {
  const ctx = useContext(ContentLayoutContext)
  if (!ctx?.asideEl) return null

  return createPortal(
    <AnimatePresence>
      {props.active ? (
        <motion.div
          animate={{ opacity: 1, x: 0 }}
          className="absolute inset-0 flex flex-col"
          exit={{ opacity: 0, x: -12 }}
          initial={{ opacity: 0, x: 16 }}
          key={props.id}
          transition={PANEL_FADE}
        >
          {props.children}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    ctx.asideEl,
  )
}

export function AsidePanel(props: {
  bodyClassName?: string
  children: ReactNode
  footer?: ReactNode
  headerActions?: ReactNode
  icon?: LucideIcon
  onClose?: () => void
  title?: ReactNode
}) {
  const { t } = useI18n()
  const Icon = props.icon
  const hasHeader =
    props.title != null || props.headerActions != null || props.onClose != null

  return (
    <div className="flex h-full min-h-0 flex-col bg-white dark:bg-neutral-950">
      {hasHeader ? (
        <div
          className={cn(
            'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800',
            APP_SHELL_HEADER_HEIGHT_CLASS,
          )}
        >
          <h2 className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-neutral-950 dark:text-neutral-50">
            {Icon ? (
              <Icon aria-hidden="true" className="size-4 shrink-0" />
            ) : null}
            {props.title ? (
              <span className="truncate">{props.title}</span>
            ) : null}
          </h2>
          <div className="flex shrink-0 items-center gap-1.5">
            {props.headerActions}
            {props.onClose ? (
              <button
                aria-label={t('ui.modal.closeAria')}
                className="inline-flex size-9 items-center justify-center rounded text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-900 dark:hover:text-neutral-200"
                onClick={props.onClose}
                type="button"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className={cn('flex min-h-0 flex-1 flex-col', props.bodyClassName)}>
        {props.children}
      </div>
      {props.footer ? (
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
          {props.footer}
        </div>
      ) : null}
    </div>
  )
}
