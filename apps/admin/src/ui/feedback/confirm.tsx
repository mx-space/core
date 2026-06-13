import type { ReactNode } from 'react'

import { useI18n } from '~/i18n'
import { ModalFooter, ModalTitle } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { cn } from '~/utils/cn'

export interface ConfirmDialogOptions {
  title: ReactNode
  description?: ReactNode
  confirmText?: ReactNode
  cancelText?: ReactNode
  destructive?: boolean
}

interface ConfirmDialogProps extends ConfirmDialogOptions {}

function ConfirmDialog(props: ConfirmDialogProps) {
  const modal = useModal<boolean>()
  const { t } = useI18n()
  const confirmText = props.confirmText ?? t('common.confirm')
  const cancelText = props.cancelText ?? t('common.cancel')

  return (
    <div className="flex w-full flex-col">
      <div className="flex shrink-0 items-start px-6 pt-5 pb-4">
        <ModalTitle className="text-lg leading-snug font-semibold break-words text-fg">
          {props.title}
        </ModalTitle>
      </div>
      {props.description ? (
        <div className="px-6 pb-4 text-sm break-words text-fg-muted">
          {props.description}
        </div>
      ) : null}
      <ModalFooter>
        <Button
          autoFocus
          onClick={() => modal.close(false)}
          variant="secondary"
        >
          {cancelText}
        </Button>
        <Button
          className={cn(
            props.destructive && 'bg-red-600 text-white hover:bg-red-700',
          )}
          onClick={() => modal.close(true)}
        >
          {confirmText}
        </Button>
      </ModalFooter>
    </div>
  )
}

/**
 * Imperative confirm dialog. Resolves true on confirm, false on cancel/dismiss.
 * Drop-in replacement for window.confirm with project-styled modal UI.
 */
export async function confirmDialog(
  options: ConfirmDialogOptions,
): Promise<boolean> {
  const handle = present<ConfirmDialogProps, boolean>(ConfirmDialog, options, {
    modalProps: {
      popupStyle: { width: 'min(92vw, 26rem)' },
    },
  })
  const result = await handle
  return result === true
}
