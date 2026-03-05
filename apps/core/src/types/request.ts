import type { FastifyReply, FastifyRequest } from 'fastify'

import type { SessionUser } from '~/modules/auth/auth.types'

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
