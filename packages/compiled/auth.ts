export { betterAuth, getCookieKey } from 'better-auth'
export { getSessionCookie, setSessionCookie } from 'better-auth/cookies'

export {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from 'better-auth/api'

export { mongodbAdapter } from 'better-auth/adapters/mongodb'
export { fromNodeHeaders, toNodeHandler } from 'better-auth/node'
export { bearer, jwt } from 'better-auth/plugins'

export type * from 'better-auth'
