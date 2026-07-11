import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { auditWithReason } from '~/data/resources/link.mutations'
import { useI18n } from '~/i18n'
import type { LinkModel } from '~/models/link'
import { LinkState, LinkStateNameKeys } from '~/models/link'
import { ModalFooter, ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { SelectField } from '~/ui/primitives/select'
import { TextArea } from '~/ui/primitives/text-field'

interface AuditReasonModalProps {
  link: LinkModel
}

function AuditReasonModal(props: AuditReasonModalProps) {
  const { t } = useI18n()
  const modal = useModal<boolean>()
  const [state, setState] = useState(LinkState.Pass)
  const [reason, setReason] = useState('')

  const mutation = useMutation({
    mutationFn: () => auditWithReason(props.link.id, reason, state),
    onSuccess: () => {
      toast.success(t('friends.toast.auditSent'))
      modal.close(true)
    },
  })

  return (
    <div className="flex w-full flex-col">
      <ModalHeader title={t('friends.audit.dialogTitle')} />
      <div className="grid gap-4 px-5 py-4">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            {t('friends.audit.state')}
          </span>
          <SelectField
            onValueChange={setState}
            options={Object.entries(LinkStateNameKeys)
              .filter(([key]) => key !== 'Audit')
              .map(([key, labelKey]) => ({
                label: t(labelKey),
                value: LinkState[key as keyof typeof LinkState],
              }))}
            triggerClassName="h-10"
            value={state}
          />
        </label>
        <TextArea
          controlClassName="min-h-24"
          label={t('friends.audit.reason')}
          maxLength={200}
          onChange={setReason}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              (event.metaKey || event.ctrlKey) &&
              !mutation.isPending
            ) {
              mutation.mutate()
            }
          }}
          placeholder={t('friends.audit.reasonPlaceholder')}
          value={reason}
        />
      </div>
      <ModalFooter>
        <Button onClick={() => modal.dismiss()} type="button" variant="subtle">
          {t('common.cancel')}
        </Button>
        <Button
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
          type="button"
        >
          {t('friends.audit.send')}
        </Button>
      </ModalFooter>
    </div>
  )
}

/**
 * Open the audit-reason modal. Resolves true on submit success.
 */
export async function presentAuditReason(
  link: LinkModel,
): Promise<boolean | undefined> {
  const handle = present<AuditReasonModalProps, boolean>(
    AuditReasonModal,
    { link },
    {
      modalProps: { popupStyle: { width: 'min(92vw, 30rem)' } },
    },
  )
  return await handle
}
