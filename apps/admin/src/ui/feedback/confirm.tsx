import type { ReactNode } from 'react'

import { useI18n } from '~/i18n'
import { ModalHeader } from '~/ui/feedback/modal'
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
      <ModalHeader showClose={false} title={props.title} />
      {props.description ? (
        <div className="px-6 py-4 text-sm text-fg">{props.description}</div>
      ) : (
        <div className="h-2" />
      )}
      <div className="flex justify-end gap-2 border-t border-border px-6 py-3">
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
      </div>
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
