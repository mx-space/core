import { useState } from 'react'

import { useI18n } from '~/i18n'
import { ModalFooter, ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'

interface NoteMetaEditDialogProps {
  initialValue: string
  label: string
  placeholder?: string
  title: string
}

function NoteMetaEditDialog(props: NoteMetaEditDialogProps) {
  const { t } = useI18n()
  const modal = useModal<string | null>()
  const [value, setValue] = useState(props.initialValue)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const next = value.trim()
    modal.close(next.length === 0 ? null : next)
  }

  return (
    <form className="flex w-full flex-col" onSubmit={handleSubmit}>
      <ModalHeader showClose={false} title={props.title} />
      <div className="space-y-2 px-4 py-4">
        <label
          className="block text-xs text-neutral-500 dark:text-neutral-400"
          htmlFor="note-meta-edit-input"
        >
          {props.label}
        </label>
        <input
          autoFocus
          className="outline-hidden block h-9 w-full rounded border border-neutral-200 bg-white px-3 text-sm text-neutral-900 transition-colors placeholder:text-neutral-400 focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-600"
          id="note-meta-edit-input"
          onChange={(event) => setValue(event.target.value)}
          placeholder={props.placeholder}
          value={value}
        />
      </div>
      <ModalFooter>
        <Button onClick={() => modal.dismiss()} type="button" variant="subtle">
          {t('common.cancel')}
        </Button>
        <Button type="submit">{t('common.save')}</Button>
      </ModalFooter>
    </form>
  )
}

/**
 * Open the meta edit modal. Resolves with the trimmed string, `null` if cleared,
 * or `undefined` if the dialog was dismissed.
 */
export async function presentNoteMetaEditModal(
  options: NoteMetaEditDialogProps,
): Promise<string | null | undefined> {
  const handle = present<NoteMetaEditDialogProps, string | null>(
    NoteMetaEditDialog,
    options,
    {
      modalProps: { popupStyle: { width: 'min(92vw, 24rem)' } },
    },
  )
  return await handle
}
