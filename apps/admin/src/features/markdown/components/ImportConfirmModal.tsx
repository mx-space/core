import { AlertCircle } from 'lucide-react'

import { useI18n } from '~/i18n'
import { ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Badge } from '~/ui/primitives/badge'
import { Button } from '~/ui/primitives/button'

import { ImportType } from '../types/markdown'

interface ImportConfirmModalProps {
  importType: ImportType
  itemCount: number
}

function ImportConfirmModal(props: ImportConfirmModalProps) {
  const { t } = useI18n()
  const modal = useModal<boolean>()

  return (
    <div className="flex w-full flex-col">
      <ModalHeader showClose={false} title={t('markdown.confirm.title')} />
      <div className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-amber-500"
          />
          <div>
            <p className="text-sm text-neutral-700 dark:text-neutral-300">
              {t('markdown.confirm.message', { count: props.itemCount })}{' '}
              <Badge>
                {props.importType === ImportType.Post
                  ? t('markdown.type.post')
                  : t('markdown.type.note')}
              </Badge>
            </p>
            <p className="mt-2 text-xs text-neutral-500">
              {t('markdown.confirm.note')}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            onClick={() => modal.close(false)}
            type="button"
            variant="subtle"
          >
            {t('common.cancel')}
          </Button>
          <Button onClick={() => modal.close(true)} type="button">
            {t('markdown.confirm.submit')}
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Open the markdown import confirmation modal. Resolves true on confirm.
 */
export async function presentImportConfirm(
  options: ImportConfirmModalProps,
): Promise<boolean> {
  const handle = present<ImportConfirmModalProps, boolean>(
    ImportConfirmModal,
    options,
    {
      modalProps: { popupStyle: { width: 'min(92vw, 28rem)' } },
    },
  )
  const result = await handle
  return result === true
}
