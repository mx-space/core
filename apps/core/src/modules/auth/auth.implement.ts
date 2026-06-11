import type { ServerResponse } from 'node:http'
import { IncomingMessage } from 'node:http'

import { apiKey } from '@better-auth/api-key'
import type { PasskeyOptions } from '@better-auth/passkey'
import { passkey } from '@better-auth/passkey'
import * as authSchema from '@mx-space/db-schema/schema'
import { compare } from 'bcryptjs'
import type { BetterAuthOptions } from 'better-auth'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { hashPassword, verifyPassword } from 'better-auth/crypto'
import { toNodeHandler } from 'better-auth/node'
import { bearer, deviceAuthorization, username } from 'better-auth/plugins'
import { and, eq } from 'drizzle-orm'
import { customAlphabet } from 'nanoid'
import wcmatch from 'wildcard-match'

import { API_VERSION, CROSS_DOMAIN } from '~/app.config'
import { SECURITY } from '~/app.config.test'
import { db } from '~/processors/database/postgres.provider'

import { validateMxUsername } from './auth.username-validator'

const bcryptRegex = /^\$2[aby]\$/
const isBcryptHash = (value?: string | null) =>
  typeof value === 'string' && bcryptRegex.test(value)

export const MXS_CLI_CLIENT_ID = 'mxs-cli'

const deviceUserCodeAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const generateDeviceUserCode = customAlphabet(deviceUserCodeAlphabet, 8)

const normalizeOrigin = (url: string | undefined): string | null => {
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

// Mirror bootstrap.ts CORS host matching: the configured allowlist entries are
// matched against an Origin's host (not the full origin) with wildcard support.
// Matchers are compiled once per allowlist instance, not per request.
let compiledOriginMatchers: {
  patterns: string[]
  matchers: ReturnType<typeof wcmatch>[]
} | null = null

const getOriginMatchers = (patterns: string[]) => {
  if (!compiledOriginMatchers || compiledOriginMatchers.patterns !== patterns) {
    compiledOriginMatchers = {
      patterns,
      matchers: patterns.map((pattern) => wcmatch(pattern)),
    }
  }
  return compiledOriginMatchers.matchers
}

const isAllowedOrigin = (origin: string | undefined): boolean => {
  if (!origin) return false
  // Dev mirrors bootstrap.ts `allowAllCors`: reflect any origin (LAN IP, tunnel
  // host, localhost) so local development against proxies/tunnels works.
  if (isDev) return true
  const allowed = CROSS_DOMAIN.allowedOrigins
  if (!Array.isArray(allowed) || allowed.length === 0) {
    return false
  }
  let host: string
  try {
    host = new URL(origin).host
  } catch {
    return false
  }
  return getOriginMatchers(allowed).some((match) => match(host))
}

export async function CreateAuth(
  providers: BetterAuthOptions['socialProviders'],
  passkeyOptions?: PasskeyOptions,
  serverUrl?: string,
) {
  const deviceVerificationPath = isDev
    ? '/device'
    : `/api/v${API_VERSION}/device`
  // `fallback` is mandatory: Better Auth throws on any request Host absent
  // from allowedHosts when it is unset.
  const fallbackOrigin = normalizeOrigin(serverUrl)
  const dynamicBaseURL: BetterAuthOptions['baseURL'] =
    isDev || !fallbackOrigin
      ? undefined
      : {
          allowedHosts: CROSS_DOMAIN.allowedOrigins,
          fallback: fallbackOrigin,
        }
  const auth = betterAuth({
    telemetry: { enabled: false },
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: authSchema,
      usePlural: true,
    }),
    socialProviders: providers,
    baseURL: dynamicBaseURL,
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
        customAPIKeyGetter: (ctx) => ctx.headers?.get('x-api-key') ?? null,
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
      bearer(),
      username({
        usernameValidator: validateMxUsername,
      }),
      deviceAuthorization({
        expiresIn: '30m',
        interval: '5s',
        userCodeLength: 8,
        schema: {},
        generateUserCode: () => generateDeviceUserCode(),
        verificationUri: deviceVerificationPath,
        onDeviceAuthRequest: async (clientId) => {
          if (clientId !== MXS_CLI_CLIENT_ID) {
            throw new APIError('BAD_REQUEST', {
              error: 'invalid_client',
              error_description: `unsupported client_id: ${clientId}`,
            })
          }
        },
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
              )!,
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
      // Only reflect the Origin (with credentials) when it matches the
      // configured allowlist. Never echo an arbitrary Origin or `*` alongside
      // `Allow-Credentials: true` — that would let any site perform
      // credentialed cross-origin reads of session/account data, bypassing the
      // Nest CORS allowlist in bootstrap.ts.
      const requestOrigin = req.headers.origin
      if (isAllowedOrigin(requestOrigin)) {
        res.setHeader('Access-Control-Allow-Origin', requestOrigin!)
        res.setHeader('Access-Control-Allow-Credentials', 'true')
        res.setHeader('Vary', 'Origin')
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
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
