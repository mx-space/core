import { HttpException } from '@nestjs/common'
import type { FastifyReply } from 'fastify'
import type { FunctionContextResponse } from './function.types'

export const createMockedContextResponse = (
  reply: FastifyReply,
): FunctionContextResponse => {
  const response: FunctionContextResponse = {
    throws(code, message) {
      throw new HttpException(message, code)
    },
    type(type: string) {
      reply.type(type)
      return response
    },
    send(data: any) {
      return reply.send(data)
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
