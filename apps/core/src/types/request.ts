import type { UserModel } from '~/modules/user/user.model'
import type { FastifyReply, FastifyRequest } from 'fastify'

export type AdapterRequest = FastifyRequest &
  (
    | {
        isGuest: true
        isMaster: false
      }
    | {
        user: UserModel
        token: string
        isGuest: false
        isMaster: true
      }
  ) &
  Record<string, any>
export type AdapterResponse = FastifyReply & Record<string, any>
