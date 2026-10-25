import { AlertTriangle } from 'lucide-react'

import { formatBytes } from '~/features/files/utils/format'
import { useI18n } from '~/i18n'
import type { DraftCard } from '~/models/draft'
import { ModalFooter, ModalTitle } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'

interface DeleteDraftDialogProps {
  drafts: DraftCard[]
}

const bytesOf = (draft: DraftCard) =>
  draft.storage.revisionBytes + draft.storage.crdtBytes

function DeleteDraftDialogBody(props: DeleteDraftDialogProps) {
  const { t } = useI18n()
  const modal = useModal<boolean>()
  const [first] = props.drafts
  const single = props.drafts.length === 1
  const total = props.drafts.reduce((sum, draft) => sum + bytesOf(draft), 0)
  const revisions = props.drafts.reduce(
    (sum, draft) => sum + draft.storage.revisionCount,
    0,
  )
  const withCrdt = props.drafts.filter((draft) => draft.storage.crdtBytes > 0)
  const published = props.drafts.some(
    (draft) => draft.document.publishedRevisionId,
  )

  return (
    <div className="flex w-full flex-col">
      <div className="flex flex-col gap-1 px-6 pt-5 pb-3">
        <ModalTitle className="text-lg leading-snug font-semibold break-words text-fg">
          {single
            ? t('drafts.deleteDialog.titleOne', {
                title: first.headRevision.title || t('drafts.row.untitled'),
              })
            : t('drafts.deleteDialog.titleMany', {
                count: props.drafts.length,
              })}
        </ModalTitle>
        <p className="text-sm text-fg-muted">
          {t('drafts.deleteDialog.subtitle')}
        </p>
      </div>
      <div className="flex flex-col gap-4 px-6 pb-4">
        {withCrdt.length ? (
          <div
            className="flex gap-2.5 rounded-md border border-orange-200 bg-orange-50 px-3.5 py-3 text-sm text-orange-900 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-200"
            role="note"
          >
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            {t('drafts.deleteDialog.collabWarning')}
          </div>
        ) : null}
        <section className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">
            {t('drafts.deleteDialog.removed')}
          </h3>
          <div className="flex text-sm text-fg">
            <span className="flex-1">
              {t('drafts.deleteDialog.removedRevisions', { count: revisions })}
            </span>
          </div>
          {withCrdt.length ? (
            <div className="flex text-sm text-fg">
              <span className="flex-1">
                {t('drafts.deleteDialog.removedCrdt')}
              </span>
              <span className="tabular-nums text-fg-muted">
                {formatBytes(
                  withCrdt.reduce(
                    (sum, draft) => sum + draft.storage.crdtBytes,
                    0,
                  ),
                )}
              </span>
            </div>
          ) : null}
        </section>
        <section className="flex flex-col gap-1.5 border-t border-border pt-3">
          <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            {t('drafts.deleteDialog.kept')}
          </h3>
          {published ? (
            <>
              <p className="text-sm text-fg">
                {t('drafts.deleteDialog.keptPublished')}
              </p>
              <p className="text-sm text-fg">
                {t('drafts.deleteDialog.keptShare')}
              </p>
            </>
          ) : (
            <p className="text-sm text-fg">
              {t('drafts.deleteDialog.keptNothing')}
            </p>
          )}
        </section>
        {published ? (
          <p className="text-xs leading-relaxed text-fg-muted">
            {t('drafts.deleteDialog.reopen')}
          </p>
        ) : null}
      </div>
      <ModalFooter>
        <Button
          autoFocus
          onClick={() => modal.close(false)}
          variant="secondary"
        >
          {t('common.cancel')}
        </Button>
        <Button
          className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
          onClick={() => modal.close(true)}
        >
          {t('drafts.deleteDialog.confirm', { size: formatBytes(total) })}
        </Button>
      </ModalFooter>
    </div>
  )
}

export async function confirmDeleteDrafts(drafts: DraftCard[]) {
  const result = await present<DeleteDraftDialogProps, boolean>(
    DeleteDraftDialogBody,
    { drafts },
    { modalProps: { popupStyle: { width: 'min(92vw, 34rem)' } } },
  )
  return result === true
}
