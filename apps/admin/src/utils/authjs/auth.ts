import { createAuthClient } from 'better-auth/client'
import { usernameClient } from 'better-auth/client/plugins'

import { passkeyClient } from '@better-auth/passkey/client'

import { API_URL } from '~/constants/env'

export const authClient = createAuthClient({
  baseURL: `${API_URL}/auth`,
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
