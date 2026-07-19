import { useState } from 'react'

import type { MembershipPlan, ReaderModel } from '~/api/readers'
import { useI18n } from '~/i18n'
import { ModalFooter, ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { DateTimePicker } from '~/ui/primitives/datetime-picker'
import { SelectField } from '~/ui/primitives/select'

export interface MembershipGrantResult {
  plan: MembershipPlan
  expiresAt: string
}

interface MembershipGrantModalProps {
  reader: ReaderModel
}

function defaultExpiresAt() {
  const date = new Date()
  date.setMonth(date.getMonth() + 1)
  const offset = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return offset.toISOString().slice(0, 16)
}

function MembershipGrantModal(props: MembershipGrantModalProps) {
  const { t } = useI18n()
  const modal = useModal<MembershipGrantResult>()
  const [plan, setPlan] = useState<MembershipPlan>('monthly')
  const [expiresAt, setExpiresAt] = useState(defaultExpiresAt)

  const submit = () => {
    if (!expiresAt) return
    modal.close({ expiresAt: new Date(expiresAt).toISOString(), plan })
  }

  return (
    <div className="flex w-full flex-col">
      <ModalHeader
        subtitle={props.reader.name ?? props.reader.handle ?? props.reader.id}
        title={t('readers.membership.grant.title')}
      />
      <div className="grid gap-4 px-5 py-4">
        <div className="grid gap-1.5 text-sm">
          <label className="font-medium text-fg">
            {t('readers.membership.grant.planLabel')}
          </label>
          <SelectField
            onValueChange={setPlan}
            options={[
              {
                label: t('readers.membership.plan.monthly'),
                value: 'monthly',
              },
              { label: t('readers.membership.plan.yearly'), value: 'yearly' },
            ]}
            value={plan}
          />
        </div>
        <DateTimePicker
          label={t('readers.membership.grant.expiresAtLabel')}
          onChange={setExpiresAt}
          required
          value={expiresAt}
        />
      </div>
      <ModalFooter>
        <Button onClick={() => modal.dismiss()} type="button" variant="subtle">
          {t('common.cancel')}
        </Button>
        <Button disabled={!expiresAt} onClick={submit} type="button">
          {t('readers.membership.grant.submit')}
        </Button>
      </ModalFooter>
    </div>
  )
}

export async function presentMembershipGrantModal(
  reader: ReaderModel,
): Promise<MembershipGrantResult | undefined> {
  const handle = present<MembershipGrantModalProps, MembershipGrantResult>(
    MembershipGrantModal,
    { reader },
    { modalProps: { popupStyle: { width: 'min(92vw, 26rem)' } } },
  )
  return await handle
}
