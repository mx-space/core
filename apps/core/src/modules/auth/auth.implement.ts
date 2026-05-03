import type { ServerResponse } from 'node:http'
import { IncomingMessage } from 'node:http'

import { apiKey } from '@better-auth/api-key'
import type { PasskeyOptions } from '@better-auth/passkey'
import { passkey } from '@better-auth/passkey'
import { compare } from 'bcryptjs'
import type { BetterAuthOptions } from 'better-auth'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { hashPassword, verifyPassword } from 'better-auth/crypto'
import { toNodeHandler } from 'better-auth/node'
import { username } from 'better-auth/plugins'
import { and, eq } from 'drizzle-orm'

import { API_VERSION, CROSS_DOMAIN } from '~/app.config'
import { SECURITY } from '~/app.config.test'
import * as authSchema from '~/database/schema/auth'
import { db } from '~/processors/database/postgres.provider'

import { validateMxUsername } from './auth.username-validator'

const bcryptRegex = /^\$2[aby]\$/
const isBcryptHash = (value?: string | null) =>
  typeof value === 'string' && bcryptRegex.test(value)

export async function CreateAuth(
  providers: BetterAuthOptions['socialProviders'],
  passkeyOptions?: PasskeyOptions,
) {
  const auth = betterAuth({
    telemetry: { enabled: false },
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: authSchema,
      usePlural: true,
    }),
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
        schema: {
          apikey: {
            modelName: 'apiKey',
          },
        },
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
      passkey({
        ...passkeyOptions,
        schema: {
          ...passkeyOptions?.schema,
          passkey: {
            ...passkeyOptions?.schema?.passkey,
            fields: {
              ...passkeyOptions?.schema?.passkey?.fields,
              credentialID: 'credentialId',
            },
          },
        },
      } as PasskeyOptions),
      username({
        usernameValidator: validateMxUsername,
      }),
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
          const [account] = await db
            .select({
              id: authSchema.accounts.id,
              password: authSchema.accounts.password,
            })
            .from(authSchema.accounts)
            .where(
              and(
                eq(authSchema.accounts.userId, userId),
                eq(authSchema.accounts.providerId, 'credential'),
              ),
            )
            .limit(1)

          if (account?.password && isBcryptHash(account.password)) {
            const password = ctx.body?.password
            if (typeof password === 'string' && password.length > 0) {
              const nextHash = await hashPassword(password)
              await db
                .update(authSchema.accounts)
                .set({ password: nextHash, updatedAt: new Date() })
                .where(eq(authSchema.accounts.id, account.id))
            }
          }
        }

        if (userId) {
          const [reader] = await db
            .select({
              id: authSchema.readers.id,
              role: authSchema.readers.role,
            })
            .from(authSchema.readers)
            .where(eq(authSchema.readers.id, userId))
            .limit(1)
          if (reader?.role === 'owner') {
            await db
              .insert(authSchema.ownerProfiles)
              .values({
                id: reader.id,
                readerId: reader.id,
                lastLoginTime: new Date(),
                ...(loginIp ? { lastLoginIp: loginIp } : {}),
              })
              .onConflictDoUpdate({
                target: authSchema.ownerProfiles.readerId,
                set: {
                  lastLoginTime: new Date(),
                  ...(loginIp ? { lastLoginIp: loginIp } : {}),
                },
              })
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

        await db
          .update(authSchema.sessions)
          .set({ provider })
          .where(eq(authSchema.sessions.token, sessionToken))
      }),
    },
    user: {
      modelName: 'reader',
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
      api: (() => {
        const _listUserAccounts = auth.api.listUserAccounts.bind(auth.api)
        return Object.assign(auth.api, {
          getProviders() {
            return Object.keys(auth.options.socialProviders || {})
          },
          async listUserAccounts(
            params: Parameters<typeof auth.api.listUserAccounts>[0],
          ) {
            try {
              return await _listUserAccounts(params)
            } catch (error) {
              if (error instanceof APIError) {
                return null
              }
              throw error
            }
          },
        })
      })(),
    },
  }
}
