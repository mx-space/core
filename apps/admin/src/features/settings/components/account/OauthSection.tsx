import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { toast } from 'sonner'
import type { OauthOptions, OauthProviderType } from '../../types/settings'

import { getOption, patchOption } from '~/api/options'
import { useI18n } from '~/i18n'

import { accountQueryKey, oauthProviders } from '../../constants'
import { flattenOauthOptions } from '../../utils/oauth'
import { getErrorMessage } from '../../utils/settings'
import { SettingsSection } from '../SettingsPrimitives'
import { GitHubIcon } from './OauthIcons'
import { OauthProviderSection } from './OauthProviderSection'

export function OauthSection() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const oauthQuery = useQuery({
    queryFn: () => getOption<OauthOptions>('oauth'),
    queryKey: [...accountQueryKey, 'oauth'],
  })

  const saveMutation = useMutation({
    mutationFn: (payload: {
      clientId: string
      clientSecret: string
      enabled: boolean
      type: OauthProviderType
    }) =>
      patchOption('oauth', {
        providers: [{ enabled: payload.enabled, type: payload.type }],
        public: {
          [payload.type]: {
            clientId: payload.clientId,
          },
        },
        secrets: {
          [payload.type]: {
            clientSecret: payload.clientSecret,
          },
        },
      }),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('settings.oauth.error.save'))),
    onSuccess: async () => {
      toast.success(t('settings.oauth.success.save'))
      await queryClient.invalidateQueries({ queryKey: accountQueryKey })
    },
  })

  const oauthData = useMemo(
    () => flattenOauthOptions(oauthQuery.data),
    [oauthQuery.data],
  )

  return (
    <SettingsSection
      description={t('settings.oauth.description')}
      title={
        <span className="inline-flex items-center gap-2">
          <GitHubIcon aria-hidden="true" className="size-4" />
          {t('settings.oauth.title')}
        </span>
      }
    >
      {oauthQuery.isLoading ? (
        <div className="py-3 text-sm text-neutral-500">
          {t('settings.common.loading')}
        </div>
      ) : (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
          {oauthProviders.map((provider) => (
            <OauthProviderSection
              data={oauthData[provider.type]}
              key={provider.type}
              label={provider.label}
              onSave={(payload) => saveMutation.mutate(payload)}
              saving={saveMutation.isPending}
              type={provider.type}
            />
          ))}
        </div>
      )}
    </SettingsSection>
  )
}
