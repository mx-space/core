import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common'
import { RequestMethod } from '@nestjs/common'
import type { FastifyBizRequest } from '~/transformers/get-req.transformer'
import type { FastifyReply } from 'fastify'

export class AllowAllCorsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler<any>) {
    const handle = next.handle()
    const response: FastifyReply<any> = context.switchToHttp().getResponse()
    const request: FastifyBizRequest = context.switchToHttp().getRequest()
    const allowedMethods = [
      RequestMethod.GET,
      RequestMethod.HEAD,
      RequestMethod.PUT,
      RequestMethod.PATCH,
      RequestMethod.POST,
      RequestMethod.DELETE,
    ]
    const allowedHeaders = [
      'Authorization',
      'Origin',
      'No-Cache',
      'X-Requested-With',
      'If-Modified-Since',
      'Last-Modified',
      'Cache-Control',
      'Expires',
      'Content-Type',
    ]
    const host = request.headers.origin
    response.headers({
      'Access-Control-Allow-Origin': host,
      'Access-Control-Allow-Headers': allowedHeaders.join(','),
      'Access-Control-Allow-Methods': allowedMethods.join(','),
      'Access-Control-Max-Age': '86400',
    })
    return handle
  }
}
