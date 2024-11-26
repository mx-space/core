import { MongoClient } from 'mongodb'
import type { BetterAuthOptions } from 'better-auth'
import type { IncomingMessage, ServerResponse } from 'node:http'

import {
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
    trustedOrigins: CROSS_DOMAIN.allowedOrigins,
    account: {
      modelName: AUTH_JS_ACCOUNT_COLLECTION,
    },
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
      toNodeHandler(auth)(req, res)
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
        listUserAccounts(
          params: Parameters<typeof auth.api.listUserAccounts>[0],
        ) {
          return auth.api.listUserAccounts(params)
        },
      },
    },
  }
}

// async function toWebRequest(req: IncomingMessage) {
//   const host = req.headers.host || 'localhost'
//   const protocol = req.headers['x-forwarded-proto'] || 'http'
//   const base = `${protocol}://${host}`

//   return getRequest(base, req)
// }

// async function toServerResponse(
//   req: IncomingMessage,
//   response: Response,
//   res: ServerResponse,
// ) {
//   response.headers.forEach((value, key) => {
//     if (!value) {
//       return
//     }
//     if (res.hasHeader(key)) {
//       res.appendHeader(key, value)
//     } else {
//       res.setHeader(key, value)
//     }
//   })

//   res.setHeader('Content-Type', response.headers.get('content-type') || '')
//   res.setHeader('access-control-allow-methods', 'GET, POST')
//   res.setHeader('access-control-allow-headers', 'content-type')
//   res.setHeader(
//     'Access-Control-Allow-Origin',
//     req.headers.origin || req.headers.referer || req.headers.host || '*',
//   )
//   res.setHeader('access-control-allow-credentials', 'true')

//   const text = await response.text()
//   res.writeHead(response.status, response.statusText)
//   res.end(text)
// }
