import { Dialog } from '@base-ui/react/dialog'
import type { ReactNode } from 'react'

import { PortalLayerScope, useFloatingZ } from '~/ui/feedback/portal-layer'
import { cn } from '~/utils/cn'

interface LightboxProps {
  actions?: ReactNode
  children: ReactNode
  className?: string
  onOpenChange: (open: boolean) => void
  open: boolean
  title?: ReactNode
}

/**
 * Dark fullscreen Dialog scaffolding for media preview.
 * Body region uses pure black for image/video framing; header is dark glass.
 */
export function Lightbox(props: LightboxProps) {
  const { depth, z } = useFloatingZ('dialog')

  return (
    <Dialog.Root onOpenChange={props.onOpenChange} open={props.open}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className="fixed inset-0 bg-black/70"
          style={{ zIndex: z - 1 }}
        />
        <Dialog.Popup
          className={cn(
            'outline-hidden shadow-lg fixed inset-4 flex flex-col overflow-hidden rounded-lg border border-white/10 bg-neutral-950 sm:inset-8',
            props.className,
          )}
          style={{ zIndex: z }}
        >
          <PortalLayerScope depth={depth}>
            {props.title || props.actions ? (
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                {props.title ? (
                  <Dialog.Title className="min-w-0 truncate text-sm font-medium text-white">
                    {props.title}
                  </Dialog.Title>
                ) : (
                  <Dialog.Title className="sr-only">Preview</Dialog.Title>
                )}
                {props.actions ? (
                  <div className="flex shrink-0 items-center gap-2">
                    {props.actions}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="flex min-h-0 flex-1 items-center justify-center bg-black p-3">
              {props.children}
            </div>
          </PortalLayerScope>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export const LightboxClose = Dialog.Close

const lightboxButtonClass =
  'inline-flex h-8 items-center gap-2 rounded-sm border border-white/15 px-2.5 text-xs text-neutral-200 transition-colors hover:bg-white/10'

export { lightboxButtonClass }
