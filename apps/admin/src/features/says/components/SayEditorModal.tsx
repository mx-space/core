import { useMutation } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { toast } from 'sonner'

import { saveSay } from '~/data/resources/say.mutations'
import { useI18n } from '~/i18n'
import type { SayModel } from '~/models/say'
import { ModalFooter, ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { TextArea, TextInput } from '~/ui/primitives/text-field'

interface SayEditorModalProps {
  say: SayModel | null
}

function SayEditorModal(props: SayEditorModalProps) {
  const { t } = useI18n()
  const modal = useModal<boolean>()
  const isEdit = Boolean(props.say?.id)
  const [text, setText] = useState(props.say?.text ?? '')
  const [author, setAuthor] = useState(props.say?.author ?? '')
  const [source, setSource] = useState(props.say?.source ?? '')
  const [textError, setTextError] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      const data = {
        author: author.trim() || undefined,
        source: source.trim() || undefined,
        text: text.trim(),
      }

      return saveSay(
        props.say?.id ? { id: props.say.id, kind: 'edit' } : { kind: 'create' },
        data,
      )
    },
    onSuccess: () => {
      toast.success(
        isEdit
          ? t('says.dialog.updateSuccess')
          : t('says.dialog.publishSuccess'),
      )
      modal.close(true)
    },
  })

  const handleSubmit = (event?: FormEvent) => {
    event?.preventDefault()

    if (!text.trim()) {
      setTextError(t('says.dialog.textRequired'))
      return
    }

    setTextError('')
    mutation.mutate()
  }

  return (
    <form className="flex w-full flex-col" onSubmit={handleSubmit}>
      <ModalHeader
        title={
          isEdit ? t('says.dialog.editTitle') : t('says.dialog.createTitle')
        }
      />

      <div className="grid gap-4 px-5 py-4">
        <div className="grid gap-1.5 text-sm">
          <TextArea
            autoFocus
            controlClassName="min-h-28"
            label={t('says.dialog.text')}
            onChange={setText}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                handleSubmit()
              }
            }}
            placeholder={t('says.dialog.textPlaceholder')}
            required
            value={text}
          />
          {textError ? (
            <span className="text-xs text-red-500">{textError}</span>
          ) : null}
        </div>

        <TextInput
          label={t('says.dialog.author')}
          onChange={setAuthor}
          placeholder={t('says.dialog.authorPlaceholder')}
          value={author}
        />
        <TextInput
          label={t('says.dialog.source')}
          onChange={setSource}
          placeholder={t('says.dialog.sourcePlaceholder')}
          value={source}
        />
      </div>

      <ModalFooter>
        <span className="mr-auto text-xs text-fg-subtle">
          {t('says.dialog.shortcut')}
        </span>
        <Button onClick={() => modal.dismiss()} type="button" variant="subtle">
          {t('common.cancel')}
        </Button>
        <Button disabled={mutation.isPending} type="submit">
          {isEdit ? t('common.save') : t('says.dialog.publish')}
        </Button>
      </ModalFooter>
    </form>
  )
}

/**
 * Open the say editor. Resolves with `true` on save success, `undefined` on dismiss.
 */
export async function presentSayEditor(
  say: SayModel | null,
): Promise<boolean | undefined> {
  const handle = present<SayEditorModalProps, boolean>(
    SayEditorModal,
    { say },
    {
      modalProps: { popupStyle: { width: 'min(92vw, 34rem)' } },
    },
  )
  return await handle
}
