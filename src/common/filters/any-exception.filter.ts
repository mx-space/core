import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { FastifyReply, FastifyRequest } from 'fastify'
import { writeFileSync } from 'fs'
import { resolve } from 'path'
import { HTTP_REQUEST_TIME } from '~/constants/meta.constant'
import { LOGGER_DIR } from '~/constants/path.constant'
import { REFLECTOR } from '~/constants/system.constant'
import { isDev } from '~/utils/index.util'
import { getIp } from '../../utils/ip.util'
import { LoggingInterceptor } from '../interceptors/logging.interceptor'
type myError = {
  readonly status: number
  readonly statusCode?: number

  readonly message?: string
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('捕获异常')
  constructor(@Inject(REFLECTOR) private reflector: Reflector) {}
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<FastifyReply>()
    const request = ctx.getRequest<FastifyRequest>()

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : (exception as myError)?.status ||
          (exception as myError)?.statusCode ||
          HttpStatus.INTERNAL_SERVER_ERROR
    if (isDev) {
      console.error(exception)
    } else {
      const ip = getIp(request)
      this.logger.warn(
        `IP: ${ip} 错误信息: (${status}) ${
          (exception as any)?.response?.message ||
          (exception as myError)?.message ||
          ''
        } Path: ${decodeURI(request.raw.url)}`,
      )

      writeFileSync(
        resolve(LOGGER_DIR, 'error.log'),
        `[${new Date().toISOString()}] ${decodeURI(request.raw.url)}: ${
          (exception as any)?.response?.message ||
          (exception as myError)?.message
        }\n`,
        // ${(exception as Error).stack || ''}\n`,
        { encoding: 'utf-8', flag: 'a+' },
      )
    }
    // @ts-ignore
    const prevRequestTs = this.reflector.get(HTTP_REQUEST_TIME, request as any)

    if (prevRequestTs) {
      const content = request.method + ' -> ' + request.url
      Logger.debug(
        '--- 响应请求：' + content + ` +${+new Date() - prevRequestTs}ms`,
        LoggingInterceptor.name,
      )
    }

    response.status(status).send({
      ok: 0,
      message:
        (exception as any)?.response?.message ||
        (exception as any)?.message ||
        '未知错误',
    })
  }
}
