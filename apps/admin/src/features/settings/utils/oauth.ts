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

  return {
    github: {
      clientId: data?.public?.github?.clientId ?? '',
      enabled: providerMap.get('github')?.enabled ?? false,
      type: 'github',
    },
    google: {
      clientId: data?.public?.google?.clientId ?? '',
      enabled: providerMap.get('google')?.enabled ?? false,
      type: 'google',
    },
  }
}
