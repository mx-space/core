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
        <div className="px-4 py-4 text-sm text-neutral-700 dark:text-neutral-300">
          {props.description}
        </div>
      ) : (
        <div className="h-2" />
      )}
      <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <Button autoFocus onClick={() => modal.close(false)} variant="subtle">
          {cancelText}
        </Button>
        <Button
          className={cn(
            props.destructive &&
              'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:text-white dark:hover:bg-red-600',
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
