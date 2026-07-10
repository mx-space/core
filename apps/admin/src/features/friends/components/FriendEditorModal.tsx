import { useMutation } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { toast } from 'sonner'

import { saveLink } from '~/data/resources/link.mutations'
import { useI18n } from '~/i18n'
import type { LinkModel } from '~/models/link'
import { LinkState, LinkStateNameKeys, LinkType } from '~/models/link'
import { ModalFooter, ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { SelectField } from '~/ui/primitives/select'
import { TextInput } from '~/ui/primitives/text-field'

interface FriendEditorModalProps {
  link: LinkModel | null
}

function FriendEditorModal(props: FriendEditorModalProps) {
  const { t } = useI18n()
  const modal = useModal<boolean>()
  const isEdit = Boolean(props.link?.id)

  const [name, setName] = useState(props.link?.name ?? '')
  const [avatar, setAvatar] = useState(props.link?.avatar ?? '')
  const [url, setUrl] = useState(props.link?.url ?? '')
  const [description, setDescription] = useState(props.link?.description ?? '')
  const [type, setType] = useState(props.link?.type ?? LinkType.Friend)
  const [state, setState] = useState(props.link?.state ?? LinkState.Pass)
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      const data = {
        avatar: avatar.trim() || undefined,
        description: description.trim() || undefined,
        name: name.trim(),
        state,
        type,
        url: url.trim(),
      }

      const mode = props.link?.id
        ? { id: props.link.id, kind: 'edit' as const }
        : { kind: 'create' as const }

      return saveLink(mode, data)
    },
    onSuccess: () => {
      toast.success(t('friends.toast.saved'))
      modal.close(true)
    },
  })

  const handleSubmit = (event?: FormEvent) => {
    event?.preventDefault()

    if (!name.trim() || !url.trim()) {
      setError(t('friends.editor.validate.required'))
      return
    }

    setError('')
    mutation.mutate()
  }

  return (
    <form className="flex w-full flex-col" onSubmit={handleSubmit}>
      <ModalHeader
        title={
          isEdit
            ? t('friends.editor.editTitle', {
                name: props.link?.name ?? '',
              })
            : t('friends.editor.createTitle')
        }
      />

      <div className="grid gap-4 px-5 py-4">
        <TextInput
          label={t('friends.editor.field.name')}
          onChange={setName}
          required
          value={name}
        />
        <TextInput
          label={t('friends.editor.field.avatar')}
          onChange={setAvatar}
          value={avatar}
        />
        <TextInput
          label={t('friends.editor.field.url')}
          onChange={setUrl}
          required
          value={url}
        />
        <TextInput
          label={t('friends.editor.field.description')}
          onChange={setDescription}
          value={description}
        />
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            {t('friends.editor.field.type')}
          </span>
          <SelectField
            onValueChange={setType}
            options={[
              {
                label: t('friends.row.typeFriend'),
                value: LinkType.Friend,
              },
              {
                label: t('friends.row.typeCollection'),
                value: LinkType.Collection,
              },
            ]}
            triggerClassName="h-10"
            value={type}
          />
        </label>
        {isEdit ? (
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              {t('friends.editor.field.state')}
            </span>
            <SelectField
              onValueChange={setState}
              options={Object.entries(LinkStateNameKeys).map(
                ([key, labelKey]) => ({
                  label: t(labelKey),
                  value: LinkState[key as keyof typeof LinkState],
                }),
              )}
              triggerClassName="h-10"
              value={state}
            />
          </label>
        ) : null}
        {error ? <span className="text-xs text-red-500">{error}</span> : null}
      </div>

      <ModalFooter>
        <Button onClick={() => modal.dismiss()} type="button" variant="subtle">
          {t('common.cancel')}
        </Button>
        <Button disabled={mutation.isPending} type="submit">
          {t('friends.editor.submit')}
        </Button>
      </ModalFooter>
    </form>
  )
}

/**
 * Open the friend editor. Resolves true on save success.
 */
export async function presentFriendEditor(
  link: LinkModel | null,
): Promise<boolean | undefined> {
  const handle = present<FriendEditorModalProps, boolean>(
    FriendEditorModal,
    { link },
    {
      modalProps: { popupStyle: { width: 'min(92vw, 34rem)' } },
    },
  )
  return await handle
}
