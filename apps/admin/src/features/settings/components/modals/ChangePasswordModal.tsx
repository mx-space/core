import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { resetAllCollections } from '~/data/resource/collection'
import { useI18n } from '~/i18n'
import { ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { TextInput } from '~/ui/primitives/text-field'
import { authClient } from '~/utils/authjs/auth'

import { getErrorMessage } from '../../utils/settings'

function ChangePasswordModal() {
  const { t } = useI18n()
  const modal = useModal<boolean>()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      if (!currentPassword || !newPassword)
        throw new Error(t('settings.password.error.empty'))
      if (newPassword !== confirmPassword)
        throw new Error(t('settings.password.error.mismatch'))
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      })
      if (result.error)
        throw new Error(
          result.error.message || t('settings.password.error.failed'),
        )
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('settings.password.error.failed'))),
    onSuccess: async () => {
      toast.success(t('settings.password.success'))
      modal.close(true)
      await authClient.signOut()
      resetAllCollections()
      navigate('/login')
    },
  })

  return (
    <div className="flex w-full flex-col">
      <ModalHeader title={t('settings.password.title')} />
      <form
        className="space-y-4 px-5 py-4"
        onSubmit={(event) => {
          event.preventDefault()
          mutation.mutate()
        }}
      >
        <TextInput
          label={t('settings.password.field.current')}
          onChange={setCurrentPassword}
          type="password"
          value={currentPassword}
        />
        <TextInput
          label={t('settings.password.field.new')}
          onChange={setNewPassword}
          type="password"
          value={newPassword}
        />
        <TextInput
          label={t('settings.password.field.confirm')}
          onChange={setConfirmPassword}
          type="password"
          value={confirmPassword}
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
            {t('settings.password.confirm.submit')}
          </Button>
        </div>
      </form>
    </div>
  )
}

export function presentChangePassword() {
  return present(
    ChangePasswordModal,
    {},
    { modalProps: { popupStyle: { width: 'min(92vw, 28rem)' } } },
  )
}
