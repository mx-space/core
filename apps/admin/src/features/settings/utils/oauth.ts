import { oauthProviders } from '../constants'
import type {
  FlatOauthProvider,
  OauthOptions,
  OauthProviderType,
} from '../types/settings'

export function flattenOauthOptions(
  data: OauthOptions | undefined,
): Record<OauthProviderType, FlatOauthProvider> {
  const providerMap = new Map(
    (data?.providers ?? []).map((provider) => [provider.type, provider]),
  )

  return Object.fromEntries(
    oauthProviders.map((provider) => {
      const publicFields = { ...data?.public?.[provider.type] }
      return [
        provider.type,
        {
          configured: Object.values(publicFields).some(Boolean),
          enabled: providerMap.get(provider.type)?.enabled ?? false,
          public: publicFields,
          type: provider.type,
        },
      ]
    }),
  ) as Record<OauthProviderType, FlatOauthProvider>
}
