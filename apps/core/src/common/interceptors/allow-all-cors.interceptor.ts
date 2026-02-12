import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common'
import type { FastifyBizRequest } from '~/transformers/get-req.transformer'
import type { FastifyReply } from 'fastify'

const ALLOWED_METHODS = 'GET,HEAD,PUT,PATCH,POST,DELETE'
const ALLOWED_HEADERS = [
  'Authorization',
  'Origin',
  'No-Cache',
  'X-Requested-With',
  'If-Modified-Since',
  'Last-Modified',
  'Cache-Control',
  'Expires',
  'Content-Type',
].join(',')

export class AllowAllCorsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler<any>) {
    const response: FastifyReply<any> = context.switchToHttp().getResponse()
    const request: FastifyBizRequest = context.switchToHttp().getRequest()

    response.headers({
      'Access-Control-Allow-Origin': request.headers.origin,
      'Access-Control-Allow-Headers': ALLOWED_HEADERS,
      'Access-Control-Allow-Methods': ALLOWED_METHODS,
      'Access-Control-Max-Age': '86400',
    })

    return next.handle()
  }
}
