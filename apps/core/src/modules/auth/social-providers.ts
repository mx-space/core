import type { BetterAuthOptions } from 'better-auth'

import type { OAuthConfig } from '../configs/configs.schema'
import { signAppleClientSecret } from './apple-client-secret'

type SocialProviders = NonNullable<BetterAuthOptions['socialProviders']>

export function buildSocialProviders(
  oauth: OAuthConfig,
  serverUrl: string,
): SocialProviders {
  const providers: SocialProviders = {}

  for (const provider of oauth.providers || []) {
    if (!provider.enabled) continue

    const type = provider.type
    const config = {
      ...oauth.public?.[type],
      ...oauth.secrets?.[type],
    }
    const redirectURI = `${serverUrl}/auth/callback/${type}`

    switch (type) {
      case 'apple': {
        const { appBundleIdentifier, clientId, keyId, privateKey, teamId } =
          config
        if (!clientId || !keyId || !privateKey || !teamId) break

        providers.apple = async () => ({
          appBundleIdentifier: appBundleIdentifier || undefined,
          clientId,
          clientSecret: await signAppleClientSecret({
            clientId,
            keyId,
            privateKey,
            teamId,
          }),
          redirectURI,
        })
        break
      }

      case 'github': {
        if (!config.clientId || !config.clientSecret) break

        providers.github = {
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          redirectURI,
          mapProfileToUser: (profile) => {
            return {
              handle: profile.login,
            }
          },
        }
        break
      }

      case 'google': {
        if (!config.clientId || !config.clientSecret) break

        providers.google = {
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          redirectURI,
        }
        break
      }
    }
  }

  return providers
}
