import { useState } from 'react'
import type { ReaderModel } from '~/api/readers'

import { useI18n } from '~/i18n'
import { ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { TextArea } from '~/ui/primitives/text-field'

interface BanReaderModalProps {
  reader: ReaderModel
}

function BanReaderModal(props: BanReaderModalProps) {
  const { t } = useI18n()
  const modal = useModal<string>()
  const [reason, setReason] = useState('')

  return (
    <div className="flex w-full flex-col">
      <ModalHeader
        subtitle={props.reader.name ?? props.reader.handle ?? props.reader.id}
        title={t('readers.ban.title')}
      />
      <div className="grid gap-4 px-5 py-4">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {t('readers.ban.desc', {
            name: props.reader.name ?? props.reader.handle ?? props.reader.id,
          })}
        </p>
        <TextArea
          autoFocus
          controlClassName="min-h-24"
          label={t('readers.ban.reasonLabel')}
          maxLength={200}
          onChange={setReason}
          placeholder={t('readers.ban.reasonPlaceholder')}
          value={reason}
        />
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-neutral-200 px-5 py-4 dark:border-neutral-800">
        <Button onClick={() => modal.dismiss()} type="button" variant="subtle">
          {t('common.cancel')}
        </Button>
        <Button
          className="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:text-white dark:hover:bg-red-600"
          onClick={() => modal.close(reason.trim())}
          type="button"
        >
          {t('readers.ban.submit')}
        </Button>
      </div>
    </div>
  )
}

export async function presentBanReaderModal(
  reader: ReaderModel,
): Promise<string | undefined> {
  const handle = present<BanReaderModalProps, string>(
    BanReaderModal,
    { reader },
    { modalProps: { popupStyle: { width: 'min(92vw, 30rem)' } } },
  )
  return await handle
}
