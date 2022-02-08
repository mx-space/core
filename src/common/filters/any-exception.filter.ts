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
import { GqlArgumentsHost } from '@nestjs/graphql'
import { FastifyReply, FastifyRequest } from 'fastify'
import { WriteStream } from 'fs'
import { resolve } from 'path'
import { HTTP_REQUEST_TIME } from '~/constants/meta.constant'
import { LOG_DIR } from '~/constants/path.constant'
import { REFLECTOR } from '~/constants/system.constant'
import { isDev } from '~/utils'
import { getIp } from '../../utils/ip.util'
import { LoggingInterceptor } from '../interceptors/logging.interceptor'
type myError = {
  readonly status: number
  readonly statusCode?: number

  readonly message?: string
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)
  private errorLogPipe: WriteStream
  constructor(@Inject(REFLECTOR) private reflector: Reflector) {}
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = GqlArgumentsHost.create(host).switchToHttp()
    const response = ctx.getResponse<FastifyReply>()
    const request = ctx.getRequest<FastifyRequest>()

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : (exception as myError)?.status ||
          (exception as myError)?.statusCode ||
          HttpStatus.INTERNAL_SERVER_ERROR

    const message =
      (exception as any)?.response?.message ||
      (exception as myError)?.message ||
      ''
    if (isDev || status === HttpStatus.INTERNAL_SERVER_ERROR) {
      Logger.error(message, undefined, 'Catch')
      Logger.error(exception, undefined, 'Catch')

      if (!isDev) {
        this.errorLogPipe =
          this.errorLogPipe ??
          fs.createWriteStream(resolve(LOG_DIR, 'error.log'), {
            flags: 'a+',
            encoding: 'utf-8',
          })

        this.errorLogPipe.write(
          `[${new Date().toISOString()}] ${decodeURI(request.raw.url)}: ${
            (exception as any)?.response?.message ||
            (exception as myError)?.message
          }\n` +
            (exception as Error).stack +
            '\n',
        )
      }
    } else {
      const ip = getIp(request)
      this.logger.warn(
        `IP: ${ip} 错误信息: (${status}) ${message} Path: ${decodeURI(
          request.raw.url,
        )}`,
      )
    }
    // @ts-ignore
    const prevRequestTs = this.reflector.get(HTTP_REQUEST_TIME, request as any)

    if (prevRequestTs) {
      const content = request.method + ' -> ' + request.url
      Logger.debug(
        '--- 响应异常请求：' +
          content +
          chalk.yellow(` +${+new Date() - prevRequestTs}ms`),
        LoggingInterceptor.name,
      )
    }

    response
      .status(status)
      .type('application/json')
      .send({
        ok: 0,
        message:
          (exception as any)?.response?.message ||
          (exception as any)?.message ||
          '未知错误',
      })
  }
}
