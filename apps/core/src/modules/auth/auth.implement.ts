import { IncomingMessage } from 'node:http'
import type { ServerResponse } from 'node:http'
import { API_VERSION, CROSS_DOMAIN, MONGO_DB } from '~/app.config'
import { SECURITY } from '~/app.config.test'
import type { BetterAuthOptions } from 'better-auth'
import { betterAuth } from 'better-auth'
import { mongodbAdapter } from 'better-auth/adapters/mongodb'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { toNodeHandler } from 'better-auth/node'
import { MongoClient } from 'mongodb'
import {
  AUTH_JS_ACCOUNT_COLLECTION,
  AUTH_JS_SESSION_COLLECTION,
  AUTH_JS_USER_COLLECTION,
} from './auth.constant'

const client = new MongoClient(MONGO_DB.customConnectionString || MONGO_DB.uri)

const db = client.db()

export async function CreateAuth(
  providers: BetterAuthOptions['socialProviders'],
) {
  const auth = betterAuth({
    telemetry: { enabled: false },
    database: mongodbAdapter(db),
    socialProviders: providers,
    basePath: isDev ? '/auth' : `/api/v${API_VERSION}/auth`,
    trustedOrigins: async (request) => {
      if (isDev) {
        if (!request) return ['http://localhost:2323']
        const origin = request.headers.get('origin')
        if (origin?.includes('localhost') || origin?.includes('127.0.0.1')) {
          return [origin]
        }
      }

      return CROSS_DOMAIN.allowedOrigins.reduce(
        (acc: string[], origin: string) => {
          if (origin.startsWith('http')) {
            return [...acc, origin]
          }
          if (origin.includes(':*')) {
            return acc
          }
          return [...acc, `https://${origin}`, `http://${origin}`]
        },
        [],
      )
    },
    account: {
      modelName: AUTH_JS_ACCOUNT_COLLECTION,
      accountLinking: {
        enabled: true,
        trustedProviders: ['google', 'github'],
      },
    },
    session: {
      modelName: AUTH_JS_SESSION_COLLECTION,
      additionalFields: {
        provider: {
          type: 'string',
          required: false,
        },
      },
    },
    appName: 'mx-core',
    secret: SECURITY.jwtSecret,
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        if (!ctx.path?.startsWith('/callback')) {
          return
        }

        let provider = ctx.params?.id
        if (!provider && ctx.path.includes('/callback/')) {
          provider = ctx.path.split('/callback/')[1]
        }
        if (!provider) {
          return
        }

        const newSession = ctx.context.newSession as
          | {
              token?: string
              sessionToken?: string
              session?: { token?: string }
            }
          | undefined

        const sessionToken =
          newSession?.token ||
          newSession?.sessionToken ||
          newSession?.session?.token

        if (!sessionToken) {
          return
        }

        await db.collection(AUTH_JS_SESSION_COLLECTION).updateOne(
          {
            token: sessionToken,
          },
          { $set: { provider } },
        )
      }),
    },
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
      // cors
      res.setHeader(
        'Access-Control-Allow-Origin',
        req.headers.origin || req.headers.referer || req.headers.host || '*',
      )
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      res.setHeader('Access-Control-Allow-Credentials', 'true')
      res.setHeader('Access-Control-Max-Age', '86400')

      const clonedRequest = new IncomingMessage(req.socket)
      const handler = toNodeHandler(auth)(
        Object.assign(clonedRequest, req, {
          url: req.originalUrl,

          // https://github.com/Bekacru/better-call/blob/main/src/adapter/node.ts
          socket: Object.assign(req.socket, {
            encrypted: isDev ? false : true,
          }),
        }),
        res,
      )

      return handler
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
