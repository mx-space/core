import { passkeyClient } from '@better-auth/passkey/client'
import { createAuthClient } from 'better-auth/client'
import { usernameClient } from 'better-auth/client/plugins'

import { API_URL } from '~/constants/env'

import { resolveAuthBaseURL } from './auth-base-url'

export const authClient = createAuthClient({
  baseURL: resolveAuthBaseURL(API_URL),
  fetchOptions: {
    credentials: 'include',
  },
  plugins: [passkeyClient(), usernameClient()],
})

export type AuthSocialProviders =
  | 'apple'
  | 'discord'
  | 'facebook'
  | 'github'
  | 'google'
  | 'microsoft'
  | 'spotify'
  | 'twitch'
  | 'twitter'
  | 'dropbox'
  | 'linkedin'
  | 'gitlab'
