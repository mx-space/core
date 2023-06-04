import { FastifyReply, FastifyRequest } from 'fastify'

import { UserModel } from '~/modules/user/user.model'

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
