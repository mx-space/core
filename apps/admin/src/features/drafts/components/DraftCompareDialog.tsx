import { RotateCcw, X } from 'lucide-react'

import { useI18n } from '~/i18n'
import type { RevisionSnapshot } from '~/models/draft'
import { ModalTitle } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { relativeTimeFromNow } from '~/utils/time'

import type { DraftDiffStats } from '../types/drafts'
import { DraftDiffPreview } from './DraftDiffPreview'

interface DraftCompareDialogProps {
  currentDraft: RevisionSnapshot
  diffStats: DraftDiffStats | null
  onRestore: () => void
  savedAt: string
  selectedDraft: RevisionSnapshot
  title: string
}

function DraftCompareDialogBody(props: DraftCompareDialogProps) {
  const { t } = useI18n()
  const modal = useModal()

  return (
    <div className="flex h-[min(86vh,56rem)] w-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-6 py-3">
        <ModalTitle className="truncate text-base font-semibold text-fg">
          {t('drafts.compare.splitTitle')} · {props.title}
        </ModalTitle>
        <span className="text-sm text-fg-muted">
          {relativeTimeFromNow(props.savedAt)} → {t('drafts.history.current')}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            className="h-8 px-2.5"
            onClick={() => {
              modal.close()
              props.onRestore()
            }}
            type="button"
            variant="subtle"
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            {t('drafts.compare.restore')}
          </Button>
          <Button
            aria-label={t('common.close')}
            className="size-8 px-0"
            onClick={() => modal.dismiss()}
            type="button"
            variant="subtle"
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>
      <Scroll className="min-h-0 flex-1" innerClassName="p-4">
        <DraftDiffPreview
          currentDraft={props.currentDraft}
          diffStats={props.diffStats}
          layout="split"
          selectedDraft={props.selectedDraft}
        />
      </Scroll>
    </div>
  )
}

export function openDraftCompareDialog(props: DraftCompareDialogProps) {
  return present(DraftCompareDialogBody, props, {
    modalProps: { popupStyle: { width: 'min(96vw, 80rem)' } },
  })
}
