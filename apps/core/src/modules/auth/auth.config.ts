import { machineIdSync } from 'node-machine-id'
import type { ServerAuthConfig } from './auth.implement'

import { authjs, MongoDBAdapter } from '@mx-space/complied/auth'

import { API_VERSION } from '~/app.config'
import { SECURITY } from '~/app.config.test'
import { isDev } from '~/global/env.global'
import { getDatabaseConnection } from '~/utils/database.util'

const github = authjs.providers.github
export const authConfig: ServerAuthConfig = {
  basePath: isDev ? '/auth' : `/api/v${API_VERSION}/auth`,
  secret: SECURITY.jwtSecret || machineIdSync(),
  callbacks: {
    redirect({ url }) {
      return url
    },
  },
  providers: [
    github({
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      clientId: `Ov23lihE5g62crHabba4`,
    }),
  ],
  experimental: {
    enableWebAuthn: true,
  },
  adapter: MongoDBAdapter(getDatabaseConnection().then((c) => c.getClient())),
}
