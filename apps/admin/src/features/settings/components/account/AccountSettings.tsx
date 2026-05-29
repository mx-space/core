import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Fingerprint, Key } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import type { OauthProviderType } from '../../types/settings'

import { authAsOwner } from '~/api/auth'
import { useI18n } from '~/i18n'
import { Drawer } from '~/ui/feedback/drawer'
import { authClient } from '~/utils/authjs/auth'

import { accountQueryKey } from '../../constants'
import { getErrorMessage } from '../../utils/settings'
import { SettingsSection } from '../SettingsPrimitives'
import { OauthSection } from './OauthSection'
import { PasskeyPanel, PasskeyPanelHeaderAction } from './PasskeyPanel'
import { PasswordSection } from './PasswordSection'
import { SessionSection } from './SessionSection'
import { TokenPanel, TokenPanelHeaderAction } from './TokenPanel'

export function AccountSettings() {
  const { t } = useI18n()
  const [activePanel, setActivePanel] = useState<'passkeys' | 'tokens' | null>(
    null,
  )
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const validateProvider = searchParams.get(
    'validate',
  ) as OauthProviderType | null

  const authAsOwnerMutation = useMutation({
    mutationFn: authAsOwner,
    onError: (error: unknown) =>
      toast.error(
        getErrorMessage(error, t('settings.account.error.authAsOwnerFailed')),
      ),
    onSuccess: async () => {
      toast.success(t('settings.account.success.authAsOwner'))
      await queryClient.invalidateQueries({ queryKey: accountQueryKey })
    },
  })

  useEffect(() => {
    if (!validateProvider) return

    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete('validate')
        return next
      },
      { replace: true },
    )

    void authClient.getSession().then((result) => {
      if (result.error || !result.data) {
        toast.error(t('settings.account.error.oauthValidateFailed'))
        return
      }

      toast.success(t('settings.account.success.oauthValidate'))
      if (window.confirm(t('settings.account.prompt.setAsOwner'))) {
        authAsOwnerMutation.mutate()
      }
    })
  }, [authAsOwnerMutation, setSearchParams, t, validateProvider])

  return (
    <>
      <div className="space-y-10">
        <SessionSection />
        <PasswordSection />
        <SettingsSection
          actions={
            <button
              className="text-sm text-[var(--color-primary)] hover:underline"
              onClick={() => setActivePanel('tokens')}
              type="button"
            >
              {t('settings.account.entry.tokenManage')}
            </button>
          }
          description={t('settings.account.entry.tokenDescription')}
          title={
            <span className="inline-flex items-center gap-2">
              <Key aria-hidden="true" className="size-4" />
              {t('settings.account.entry.tokenTitle')}
            </span>
          }
        />
        <SettingsSection
          actions={
            <button
              className="text-sm text-[var(--color-primary)] hover:underline"
              onClick={() => setActivePanel('passkeys')}
              type="button"
            >
              {t('settings.account.entry.passkeyManage')}
            </button>
          }
          description={t('settings.account.entry.passkeyDescription')}
          title={
            <span className="inline-flex items-center gap-2">
              <Fingerprint aria-hidden="true" className="size-4" />
              {t('settings.account.entry.passkeyTitle')}
            </span>
          }
        />
        <OauthSection />
      </div>

      <Drawer
        bodyClassName="overflow-hidden"
        headerActions={<TokenPanelHeaderAction />}
        icon={Key}
        onClose={() => setActivePanel(null)}
        open={activePanel === 'tokens'}
        title={t('settings.account.entry.tokenTitle')}
        widthClassName="w-[min(90vw,32rem)]"
      >
        <TokenPanel />
      </Drawer>

      <Drawer
        bodyClassName="overflow-hidden"
        headerActions={<PasskeyPanelHeaderAction />}
        icon={Fingerprint}
        onClose={() => setActivePanel(null)}
        open={activePanel === 'passkeys'}
        title={t('settings.passkey.title')}
        widthClassName="w-[min(90vw,32rem)]"
      >
        <PasskeyPanel />
      </Drawer>
    </>
  )
}
