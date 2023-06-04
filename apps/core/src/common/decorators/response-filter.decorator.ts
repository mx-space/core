import type { FastifyRequest } from 'fastify'

import { SetMetadata } from '@nestjs/common'

import { HTTP_RESPONSE_FILTER } from '~/constants/meta.constant'

export const ResponseFilter: (
  fn: (data: any, request: FastifyRequest & KV, handler: Function) => any,
) => MethodDecorator = (type) => {
  return (_, __, descriptor: any) => {
    SetMetadata(HTTP_RESPONSE_FILTER, type)(descriptor.value)
  }
}
