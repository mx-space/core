import type { UserModel } from '~/modules/user/user.model'
import type { FastifyReply, FastifyRequest } from 'fastify'

export type AdapterRequest = FastifyRequest &
  (
    | {
        isGuest: true
        isAuthenticated: false
      }
    | {
        user: UserModel
        token: string
        isGuest: false
        isAuthenticated: true
      }
  ) &
  Record<string, any>
export type AdapterResponse = FastifyReply & Record<string, any>
