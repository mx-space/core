import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Fingerprint, Plus, Shield, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { deletePasskey, listPasskeys } from '~/api/auth'
import { getOption, patchOption } from '~/api/options'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { Switch } from '~/ui/primitives/switch'
import { TextInput } from '~/ui/primitives/text-field'
import { authClient } from '~/utils/authjs/auth'

import { accountQueryKey } from '../../constants'
import { formatDateTime, getErrorMessage } from '../../utils/settings'
import { EmptyState } from '../SettingsPrimitives'

export function PasskeyPanelHeaderAction() {
  const { t } = useI18n()
  const validateMutation = useMutation({
    mutationFn: async () => {
      const result = await authClient.signIn.passkey()
      if (result.error) {
        throw new Error(
          result.error.message || t('settings.passkey.error.validate'),
        )
      }
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('settings.passkey.error.validate'))),
    onSuccess: () => {
      toast.success(t('settings.passkey.success.validate'))
    },
  })

  return (
    <Button
      disabled={validateMutation.isPending}
      onClick={() => validateMutation.mutate()}
      type="button"
      variant="subtle"
    >
      <Shield aria-hidden="true" className="size-4" />
      {t('settings.passkey.action.validate')}
    </Button>
  )
}

export function PasskeyPanel() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')

  const authSecurityQuery = useQuery({
    queryFn: () =>
      getOption<{ disablePasswordLogin?: boolean }>('authSecurity'),
    queryKey: [...accountQueryKey, 'auth-security'],
  })

  const passkeysQuery = useQuery({
    queryFn: listPasskeys,
    queryKey: [...accountQueryKey, 'passkeys'],
  })

  const updateAuthSecurityMutation = useMutation({
    mutationFn: (disablePasswordLogin: boolean) =>
      patchOption('authSecurity', { disablePasswordLogin }),
    onError: (error: unknown) =>
      toast.error(
        getErrorMessage(error, t('settings.passkey.error.updateAuthSecurity')),
      ),
    onSuccess: async () => {
      toast.success(t('settings.passkey.success.updateAuthSecurity'))
      await queryClient.invalidateQueries({ queryKey: accountQueryKey })
    },
  })

  const addMutation = useMutation({
    mutationFn: async () => {
      const result = await authClient.passkey.addPasskey({
        name:
          name.trim() ||
          t('settings.passkey.nameDefault', {
            date: new Date().toLocaleDateString(),
          }),
      })
      if (result.error)
        throw new Error(
          result.error.message || t('settings.passkey.error.addFailed'),
        )
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('settings.passkey.error.add'))),
    onSuccess: async () => {
      toast.success(t('settings.passkey.success.add'))
      setName('')
      await queryClient.invalidateQueries({ queryKey: accountQueryKey })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deletePasskey,
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('settings.passkey.error.delete'))),
    onSuccess: async () => {
      toast.success(t('settings.passkey.success.delete'))
      await queryClient.invalidateQueries({ queryKey: accountQueryKey })
    },
  })

  return (
    <>
      <div className="border-b border-neutral-100 p-4 dark:border-neutral-900">
        <Switch
          checked={Boolean(authSecurityQuery.data?.disablePasswordLogin)}
          description={t('settings.passkey.switch.disablePasswordDescription')}
          disabled={
            authSecurityQuery.isLoading || updateAuthSecurityMutation.isPending
          }
          label={t('settings.passkey.switch.disablePassword')}
          onCheckedChange={(checked) => {
            if (checked && (passkeysQuery.data ?? []).length === 0) {
              toast.error(t('settings.passkey.error.needOne'))
              return
            }
            updateAuthSecurityMutation.mutate(checked)
          }}
        />
      </div>
      <div className="border-b border-neutral-100 p-4 dark:border-neutral-900">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            addMutation.mutate()
          }}
        >
          <TextInput
            className="min-w-48 flex-1"
            onChange={setName}
            placeholder={t('settings.passkey.namePlaceholder')}
            value={name}
          />
          <Button disabled={addMutation.isPending} type="submit">
            <Plus aria-hidden="true" className="size-4" />
            {t('settings.passkey.action.add')}
          </Button>
        </form>
      </div>
      <Scroll className="flex-1">
        {passkeysQuery.isLoading ? (
          <div className="p-4 text-sm text-neutral-500">
            {t('settings.common.loading')}
          </div>
        ) : (passkeysQuery.data ?? []).length === 0 ? (
          <EmptyState
            icon={<Fingerprint className="size-7" />}
            label={t('settings.passkey.empty')}
          />
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
            {passkeysQuery.data?.map((passkey) => (
              <div
                className="flex items-center justify-between gap-3 p-4"
                key={passkey.id}
              >
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-medium">
                    {passkey.name || passkey.id}
                  </h3>
                  <p className="mt-1 truncate font-mono text-xs text-neutral-500">
                    {passkey.credentialID}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {t('settings.passkey.createdAt', {
                      time: formatDateTime(passkey.createdAt),
                    })}
                  </p>
                </div>
                <Button
                  onClick={() => {
                    if (window.confirm(t('settings.passkey.confirm.delete'))) {
                      deleteMutation.mutate(passkey.id)
                    }
                  }}
                  type="button"
                  variant="subtle"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Scroll>
    </>
  )
}
