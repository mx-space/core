import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { TokenModel } from '~/models/token'

import { createToken } from '~/api/auth'
import { useI18n } from '~/i18n'
import { ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { DateTimePicker } from '~/ui/primitives/datetime-picker'
import { Switch } from '~/ui/primitives/switch'
import { TextInput } from '~/ui/primitives/text-field'

import { accountQueryKey } from '../../constants'
import {
  formatDateTime,
  formatDateTimeInputValue,
  getErrorMessage,
} from '../../utils/settings'

function CreateTokenModal() {
  const { t } = useI18n()
  const modal = useModal<TokenModel>()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [expires, setExpires] = useState(formatDateTimeInputValue(new Date()))
  const [expiresEnabled, setExpiresEnabled] = useState(false)

  const mutation = useMutation({
    mutationFn: () =>
      createToken({
        expired: expiresEnabled ? new Date(expires).toISOString() : undefined,
        name,
      }),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('settings.token.error.create'))),
    onSuccess: async (token) => {
      try {
        await navigator.clipboard.writeText(token.token)
        toast.success(t('settings.token.success.create'))
      } catch {
        toast.success(t('settings.token.success.createNoCopy'))
      }
      await queryClient.invalidateQueries({ queryKey: accountQueryKey })
      modal.close(token)
    },
  })

  return (
    <div className="flex w-full flex-col">
      <ModalHeader title={t('settings.token.modal.create')} />
      <form
        className="space-y-4 px-5 py-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (!name.trim()) {
            toast.warning(t('settings.token.validation.needName'))
            return
          }
          if (expiresEnabled && Number.isNaN(new Date(expires).getTime())) {
            toast.warning(t('settings.token.validation.invalidExpire'))
            return
          }
          mutation.mutate()
        }}
      >
        <TextInput
          label={t('settings.token.field.name')}
          onChange={setName}
          placeholder={t('settings.token.createTokenInputPlaceholder')}
          required
          value={name}
        />
        <Switch
          checked={expiresEnabled}
          label={t('settings.token.field.expireSwitch')}
          onCheckedChange={setExpiresEnabled}
        />
        <DateTimePicker
          disabled={!expiresEnabled}
          label={t('settings.token.field.expire')}
          onChange={setExpires}
          placeholder={t('settings.token.expirePlaceholder')}
          value={expires}
        />
        <div className="flex justify-end gap-2">
          <Button
            onClick={() => modal.dismiss()}
            type="button"
            variant="subtle"
          >
            {t('common.cancel')}
          </Button>
          <Button disabled={mutation.isPending} type="submit">
            {t('common.create')}
          </Button>
        </div>
      </form>
    </div>
  )
}

function CreatedTokenModal(props: { token: TokenModel }) {
  const { t } = useI18n()
  const modal = useModal<void>()
  const token = props.token

  return (
    <div className="flex w-full flex-col">
      <ModalHeader title={t('settings.token.modal.createdTitle')} />
      <div className="space-y-4 px-5 py-4">
        <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
          {t('settings.token.created.success')}
        </div>
        <div className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900">
          <span className="text-neutral-500">
            {t('settings.token.created.nameLabel')}
          </span>
          <span className="font-medium">{token.name}</span>
        </div>
        <div className="flex items-center gap-2 rounded border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
          <code className="min-w-0 flex-1 break-all text-xs">
            {token.token}
          </code>
          <Button
            onClick={() => {
              void navigator.clipboard.writeText(token.token)
              toast.success(t('settings.token.created.copyConfirm'))
            }}
            type="button"
            variant="subtle"
          >
            <Copy aria-hidden="true" className="size-4" />
          </Button>
        </div>
        {token.expired ? (
          <div className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900">
            <span className="text-neutral-500">
              {t('settings.token.created.expireAt')}
            </span>
            <span className="font-medium">
              {formatDateTime(String(token.expired))}
            </span>
          </div>
        ) : null}
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          {t('settings.token.created.hiddenWarning')}
        </p>
        <div className="flex justify-end">
          <Button onClick={() => modal.close()} type="button">
            {t('common.close')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export async function presentCreateToken() {
  const created = await present<{}, TokenModel>(
    CreateTokenModal,
    {},
    { modalProps: { popupStyle: { width: 'min(92vw, 32rem)' } } },
  )
  if (created) {
    await present(
      CreatedTokenModal,
      { token: created },
      { modalProps: { popupStyle: { width: 'min(92vw, 32rem)' } } },
    )
  }
  return created
}
