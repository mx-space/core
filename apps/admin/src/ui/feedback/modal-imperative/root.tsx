import { Modal } from '~/ui/feedback/modal'
import { PortalLayerScope } from '~/ui/feedback/portal-layer'

import { ModalInstanceProvider } from './context'
import { getDismissGuard } from './dismiss-guard'
import { modalStore, useModalStore } from './store'
import type { ModalHandle } from './types'

async function confirmThenDismiss(handle: ModalHandle) {
  const { confirmDialog } = await import('~/ui/feedback/confirm')
  const ok = await confirmDialog({
    title: 'Discard unsaved changes?',
    description:
      'You have unsaved changes. Closing this dialog will discard them.',
    confirmText: 'Discard',
    cancelText: 'Keep editing',
    destructive: true,
  })
  if (ok) handle.dismiss()
}

/**
 * Z-stack stride: each modal reserves this many depth steps so its descendants
 * (popovers, nested dialogs) stay below the next stacked modal. See spec
 * `docs/superpowers/specs/2026-05-26-imperative-modal-design.md` § z-index.
 */
const Z_STACK_STRIDE = 10

export function ModalRoot() {
  const stack = useModalStore((s) => s.stack)
  const topIndex = stack.length - 1

  return (
    <>
      {stack.map((inst, index) => {
        const isTop = index === topIndex
        const baseDepth = index * Z_STACK_STRIDE
        const Component = inst.Component
        return (
          <PortalLayerScope key={inst.id} depth={baseDepth}>
            <ModalInstanceProvider value={inst.handle}>
              <Modal
                {...inst.options.modalProps}
                onExitComplete={() => modalStore.remove(inst.id)}
                onOpenChange={(open, eventDetails) => {
                  if (open) return
                  if (!isTop || !inst.options.dismissable) {
                    eventDetails.cancel()
                    return
                  }
                  const guard = getDismissGuard(inst.id)
                  if (guard && guard()) {
                    eventDetails.cancel()
                    void confirmThenDismiss(inst.handle)
                    return
                  }
                  inst.handle.dismiss()
                }}
                open={inst.status === 'open'}
              >
                <Component {...inst.props} />
              </Modal>
            </ModalInstanceProvider>
          </PortalLayerScope>
        )
      })}
    </>
  )
}
