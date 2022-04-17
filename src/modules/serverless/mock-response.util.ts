import type { FastifyReply } from 'fastify'

import { HttpException } from '@nestjs/common'

import type { FunctionContextResponse } from './function.types'

export const createMockedContextResponse = (
  reply: FastifyReply,
): FunctionContextResponse => {
  const response: FunctionContextResponse = {
    throws(code, message) {
      throw new HttpException(
        HttpException.createBody({ message }, message, code),
        code,
      )
    },
    type(type: string) {
      reply.type(type)
      return response
    },
    send(data: any) {
      reply.send(data)
    },
    status(code: number, message?: string) {
      reply.raw.statusCode = code
      if (message) {
        reply.raw.statusMessage = message
      }
      return response
    },
  }
  return response
}
