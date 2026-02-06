import type { SessionUser } from '~/modules/auth/auth.types'
import type { FastifyReply, FastifyRequest } from 'fastify'

export type AdapterRequest = FastifyRequest &
  (
    | {
        isGuest: true
        isAuthenticated: false
      }
    | {
        user: SessionUser
        token: string
        isGuest: false
        isAuthenticated: true
      }
  ) &
  Record<string, any>
export type AdapterResponse = FastifyReply & Record<string, any>
