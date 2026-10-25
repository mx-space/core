import { Check, FilePenLine, ListChecks } from 'lucide-react'
import { useState } from 'react'

import { formatBytes } from '~/features/files/utils/format'
import { useI18n } from '~/i18n'
import type { OrganizerArticle } from '~/models/draft'
import { ModalFooter, ModalTitle } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { Checkbox } from '~/ui/primitives/checkbox'

import { organizerTotals } from '../utils/organizer'

export function OrganizerConfirmation(props: {
  items: OrganizerArticle[]
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useI18n()
  const [acknowledged, setAcknowledged] = useState(false)
  const totals = organizerTotals(props.items)
  return (
    <div className="flex max-h-[85dvh] flex-col">
      <div className="min-h-0 overflow-y-auto px-6 pt-5 pb-5">
        <div className="mb-3 flex items-center gap-2 text-xs text-fg-subtle">
          <ListChecks aria-hidden="true" className="size-4" />
          {t('drafts.organizer.review')}
        </div>
        <ModalTitle className="text-xl font-semibold text-fg">
          {t('drafts.organizer.confirmTitle', { count: props.items.length })}
        </ModalTitle>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          {t('drafts.organizer.confirmIntro')}
        </p>
        <div className="my-5 flex items-center justify-between rounded-md border border-border bg-surface-inset px-4 py-3">
          <div>
            <p className="text-sm font-medium text-fg">
              {t('drafts.organizer.selection', {
                count: props.items.length,
                drafts: totals.drafts,
              })}
            </p>
            <p className="mt-1 text-xs text-fg-subtle">
              {t('drafts.organizer.estimated')}
            </p>
          </div>
          <span className="text-xl font-semibold tabular-nums text-fg">
            {formatBytes(totals.bytes)}
          </span>
        </div>
        <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">
          {t('drafts.organizer.removed')}
        </h3>
        <ul className="mt-2 space-y-2 text-sm text-fg-muted">
          <li>{t('drafts.organizer.draftCount', { count: totals.drafts })}</li>
          <li>
            {t('drafts.organizer.revisionCount', { count: totals.revisions })}
          </li>
          <li>{t('drafts.organizer.collab')}</li>
        </ul>
        {totals.changed > 0 && (
          <div className="mt-4 rounded-md bg-amber-50 px-3 py-3 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <p className="flex items-center gap-2 text-sm font-medium">
              <FilePenLine aria-hidden="true" className="size-4" />
              {t('drafts.organizer.changedNotice', { count: totals.changed })}
            </p>
            <p className="mt-1 text-xs leading-relaxed">
              {t('drafts.organizer.irreversible')}
            </p>
          </div>
        )}
        <div className="mt-5 border-t border-border pt-4">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            <Check aria-hidden="true" className="size-4" />
            {t('drafts.organizer.kept')}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-fg-muted">
            {t('drafts.organizer.keptShared')}
          </p>
        </div>
        {totals.changed > 0 && (
          <div className="mt-5 border-t border-border pt-4">
            <Checkbox
              checked={acknowledged}
              label={t('drafts.organizer.ack', { count: totals.changed })}
              onCheckedChange={setAcknowledged}
            />
          </div>
        )}
      </div>
      <ModalFooter className="px-6">
        <Button onClick={props.onCancel} variant="secondary">
          {t('drafts.organizer.back')}
        </Button>
        <Button
          className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
          disabled={totals.changed > 0 && !acknowledged}
          onClick={props.onConfirm}
        >
          {t('drafts.organizer.discard', { count: totals.drafts })}
        </Button>
      </ModalFooter>
    </div>
  )
}

function OrganizerConfirmationModal(props: { items: OrganizerArticle[] }) {
  const modal = useModal<boolean>()
  return (
    <OrganizerConfirmation
      {...props}
      onCancel={() => modal.close(false)}
      onConfirm={() => modal.close(true)}
    />
  )
}

export async function confirmOrganizer(items: OrganizerArticle[]) {
  return (
    (await present<{ items: OrganizerArticle[] }, boolean>(
      OrganizerConfirmationModal,
      { items },
      { modalProps: { popupStyle: { width: 'min(94vw, 35rem)' } } },
    )) === true
  )
}
