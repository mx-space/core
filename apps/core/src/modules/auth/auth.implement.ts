import { IncomingMessage } from 'node:http'
import { MongoClient } from 'mongodb'
import type { BetterAuthOptions } from 'better-auth'
import type { ServerResponse } from 'node:http'

import {
  APIError,
  bearer,
  betterAuth,
  jwt,
  mongodbAdapter,
  toNodeHandler,
} from '@mx-space/complied/auth'

import { API_VERSION, CROSS_DOMAIN, MONGO_DB } from '~/app.config'

import {
  AUTH_JS_ACCOUNT_COLLECTION,
  AUTH_JS_USER_COLLECTION,
} from './auth.constant'

const client = new MongoClient(MONGO_DB.customConnectionString || MONGO_DB.uri)

const db = client.db()

export async function CreateAuth(config: BetterAuthOptions['socialProviders']) {
  const auth = betterAuth({
    database: mongodbAdapter(db),
    socialProviders: config,
    basePath: isDev ? '/auth' : `/api/v${API_VERSION}/auth`,
    trustedOrigins: CROSS_DOMAIN.allowedOrigins.reduce(
      (acc: string[], origin: string) => {
        if (origin.startsWith('http')) {
          return [...acc, origin]
        }
        return [...acc, `https://${origin}`, `http://${origin}`]
      },
      [],
    ),
    account: {
      modelName: AUTH_JS_ACCOUNT_COLLECTION,
      accountLinking: {
        enabled: true,
        trustedProviders: ['google', 'github'],
      },
    },
    appName: 'mx-core',

    plugins: [
      jwt({
        jwt: {
          definePayload: async (user) => {
            const account = await db
              .collection(AUTH_JS_ACCOUNT_COLLECTION)
              .findOne({
                userId: user.id,
              })
            return {
              id: user.id,
              email: user.email,
              provider: account?.provider,
              providerAccountId: account?.providerAccountId,
            }
          },
        },
      }),
      bearer(),
    ],
    user: {
      modelName: AUTH_JS_USER_COLLECTION,
      additionalFields: {
        isOwner: {
          type: 'boolean',
          defaultValue: false,
          input: false,
        },
        handle: {
          type: 'string',
          defaultValue: '',
        },
      },
    },
  })

  const handler = async (req: IncomingMessage, res: ServerResponse) => {
    try {
      res.setHeader('access-control-allow-methods', 'GET, POST')
      res.setHeader('access-control-allow-headers', 'content-type')
      res.setHeader(
        'Access-Control-Allow-Origin',
        req.headers.origin || req.headers.referer || req.headers.host || '*',
      )
      res.setHeader('access-control-allow-credentials', 'true')
      return toNodeHandler(auth)(
        Object.assign(new IncomingMessage(req.socket), req, {
          url: req.originalUrl,
        }),
        res,
      )
    } catch (error) {
      console.error(error)
      // throw error
      res.end(error.message)
    }
  }

  return {
    handler,
    auth: {
      options: auth.options,
      api: {
        getSession(params: Parameters<typeof auth.api.getSession>[0]) {
          return auth.api.getSession(params)
        },
        getProviders() {
          return Object.keys(auth.options.socialProviders || {})
        },
        async listUserAccounts(
          params: Parameters<typeof auth.api.listUserAccounts>[0],
        ) {
          try {
            const result = await auth.api.listUserAccounts(params)
            return result
          } catch (error) {
            if (error instanceof APIError) {
              return null
            }
            throw error
          }
        },
      },
    },
  }
}
