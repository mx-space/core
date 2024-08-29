import { machineIdSync } from 'node-machine-id'
import type { ServerAuthConfig } from './auth.implement'

import { MongoDBAdapter } from '@mx-space/complied/auth'

import { API_VERSION } from '~/app.config'
import { SECURITY } from '~/app.config.test'
import { isDev } from '~/global/env.global'
import { getDatabaseConnection } from '~/utils/database.util'

import { AUTH_JS_USER_COLLECTION } from './auth.constant'

export const authConfig: ServerAuthConfig = {
  basePath: isDev ? '/auth' : `/api/v${API_VERSION}/auth`,
  secret: SECURITY.jwtSecret || machineIdSync(),
  callbacks: {
    redirect({ url }) {
      return url
    },
  },
  providers: [],
  experimental: {
    enableWebAuthn: true,
  },
  adapter: MongoDBAdapter(
    getDatabaseConnection().then((c) => c.getClient()),
    {
      collections: { Users: AUTH_JS_USER_COLLECTION },
    },
  ),
}
