import { IncomingMessage } from 'node:http'
import type { ServerResponse } from 'node:http'
import type { PasskeyOptions } from '@better-auth/passkey'
import { passkey } from '@better-auth/passkey'
import { API_VERSION, CROSS_DOMAIN, MONGO_DB } from '~/app.config'
import { SECURITY } from '~/app.config.test'
import {
  ACCOUNT_COLLECTION_NAME,
  OWNER_PROFILE_COLLECTION_NAME,
  READER_COLLECTION_NAME,
  SESSION_COLLECTION_NAME,
} from '~/constants/db.constant'
import { compare } from 'bcryptjs'
import type { BetterAuthOptions } from 'better-auth'
import { betterAuth } from 'better-auth'
import { mongodbAdapter } from 'better-auth/adapters/mongodb'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { hashPassword, verifyPassword } from 'better-auth/crypto'
import { toNodeHandler } from 'better-auth/node'
import { apiKey, username } from 'better-auth/plugins'
import { MongoClient, ObjectId } from 'mongodb'

const client = new MongoClient(MONGO_DB.customConnectionString || MONGO_DB.uri)

const db = client.db()

const bcryptRegex = /^\$2[aby]\$/
const isBcryptHash = (value?: string | null) =>
  typeof value === 'string' && bcryptRegex.test(value)

export async function CreateAuth(
  providers: BetterAuthOptions['socialProviders'],
  passkeyOptions?: PasskeyOptions,
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
      modelName: ACCOUNT_COLLECTION_NAME,
      accountLinking: {
        enabled: true,
        trustedProviders: ['google', 'github'],
      },
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      password: {
        hash: async (password) => hashPassword(password),
        verify: async ({ hash, password }) => {
          if (isBcryptHash(hash)) {
            return compare(password, hash)
          }

          return verifyPassword({ hash, password })
        },
      },
    },
    session: {
      modelName: SESSION_COLLECTION_NAME,
      additionalFields: {
        provider: {
          type: 'string',
          required: false,
        },
      },
    },
    appName: 'mx-core',
    secret: SECURITY.jwtSecret,
    plugins: [
      apiKey({
        apiKeyHeaders: ['x-api-key'],
        disableKeyHashing: true,
        defaultKeyLength: 43,
        customAPIKeyGetter: (ctx) => {
          const headerKey = ctx.headers?.get('x-api-key')
          if (headerKey) {
            return headerKey
          }
          const authorization = ctx.headers?.get('authorization')
          if (!authorization) return null
          const match = authorization.startsWith('Bearer ')
            ? authorization.slice(7)
            : null
          return match
        },
      }),
      passkey(passkeyOptions),
      username(),
    ],
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.body?.role !== undefined) {
          throw new APIError('FORBIDDEN', {
            message: 'role cannot be modified',
          })
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        const newSession = ctx.context.newSession as
          | {
              token?: string
              sessionToken?: string
              user?: { id?: string }
              session?: { token?: string }
            }
          | undefined

        const userId = newSession?.user?.id
        const headers = ctx.headers
        const loginIpRaw =
          headers?.get('x-forwarded-for') || headers?.get('x-real-ip') || ''
        const loginIp = loginIpRaw.split(',')[0]?.trim()

        if (
          userId &&
          ['/sign-in/username', '/sign-in/email'].includes(ctx.path || '')
        ) {
          const userObjectId = ObjectId.isValid(userId)
            ? new ObjectId(userId)
            : null
          const account = await db.collection(ACCOUNT_COLLECTION_NAME).findOne(
            userObjectId
              ? {
                  userId: { $in: [userId, userObjectId] },
                  providerId: 'credential',
                }
              : { userId, providerId: 'credential' },
            {
              projection: {
                _id: 1,
                password: 1,
              },
            },
          )

          if (account?.password && isBcryptHash(account.password)) {
            const password = ctx.body?.password
            if (typeof password === 'string' && password.length > 0) {
              const nextHash = await hashPassword(password)
              await db
                .collection(ACCOUNT_COLLECTION_NAME)
                .updateOne(
                  { _id: account._id },
                  { $set: { password: nextHash, updatedAt: new Date() } },
                )
            }
          }
        }

        if (userId) {
          const userObjectId = ObjectId.isValid(userId)
            ? new ObjectId(userId)
            : null
          const reader = userObjectId
            ? await db
                .collection(READER_COLLECTION_NAME)
                .findOne({ _id: userObjectId }, { projection: { role: 1 } })
            : null
          if (reader?.role === 'owner') {
            await db.collection(OWNER_PROFILE_COLLECTION_NAME).updateOne(
              { readerId: reader._id },
              {
                $set: {
                  lastLoginTime: new Date(),
                  ...(loginIp ? { lastLoginIp: loginIp } : {}),
                },
                $setOnInsert: {
                  readerId: reader._id,
                  created: new Date(),
                },
              },
              { upsert: true },
            )
          }
        }

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

        const sessionToken =
          newSession?.token ||
          newSession?.sessionToken ||
          newSession?.session?.token

        if (!sessionToken) {
          return
        }

        await db.collection(SESSION_COLLECTION_NAME).updateOne(
          {
            token: sessionToken,
          },
          { $set: { provider } },
        )
      }),
    },
    user: {
      modelName: READER_COLLECTION_NAME,
      additionalFields: {
        role: {
          type: 'string',
          defaultValue: 'reader',
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
      res.setHeader(
        'Access-Control-Allow-Origin',
        req.headers.origin || req.headers.referer || req.headers.host || '*',
      )
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      res.setHeader('Access-Control-Allow-Credentials', 'true')
      res.setHeader('Access-Control-Max-Age', '86400')

      const clonedRequest = new IncomingMessage(req.socket)
      return toNodeHandler(auth)(
        Object.assign(clonedRequest, req, {
          url: req.originalUrl,

          // https://github.com/Bekacru/better-call/blob/main/src/adapter/node.ts
          socket: Object.assign(req.socket, {
            encrypted: !isDev,
          }),
        }),
        res,
      )
    } catch (error) {
      console.error(error)
      res.end(error.message)
    }
  }

  return {
    handler,
    auth: {
      options: auth.options,
      api: {
        ...auth.api,
        getProviders() {
          return Object.keys(auth.options.socialProviders || {})
        },
        async listUserAccounts(
          params: Parameters<typeof auth.api.listUserAccounts>[0],
        ) {
          try {
            return await auth.api.listUserAccounts(params)
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
