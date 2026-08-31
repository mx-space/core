import { AlertTriangle } from 'lucide-react'

import { useI18n } from '~/i18n'
import { Modal, ModalFooter, ModalHeader } from '~/ui/feedback/modal'
import { Button } from '~/ui/primitives/button'

interface DraftConflictDialogProps {
  conflictCount: number
  onClose: () => void
  onKeepLocal: () => void
  onUseRemote: () => void
  open: boolean
}

export function DraftConflictDialog(props: DraftConflictDialogProps) {
  const { t } = useI18n()

  return (
    <Modal
      className="w-[min(92vw,32rem)]"
      onClose={props.onClose}
      open={props.open}
    >
      <ModalHeader
        icon={AlertTriangle}
        title={t('write.conflict.dialog.title')}
      />
      <div className="space-y-3 p-4 text-sm leading-6 text-fg-muted">
        <p>
          {t('write.conflict.message', {
            count: props.conflictCount,
          })}
        </p>
        <p>{t('write.conflict.dialog.guidance')}</p>
      </div>
      <ModalFooter>
        <Button
          data-testid="draft-conflict-cancel"
          onClick={props.onClose}
          type="button"
          variant="ghost"
        >
          {t('common.cancel')}
        </Button>
        <Button
          data-testid="draft-conflict-use-remote"
          onClick={props.onUseRemote}
          type="button"
          variant="secondary"
        >
          {t('write.conflict.useRemote')}
        </Button>
        <Button
          data-testid="draft-conflict-keep-local"
          onClick={props.onKeepLocal}
          type="button"
        >
          {t('write.conflict.keepLocal')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
