import { FastifyReply, FastifyRequest } from 'fastify'
import { WriteStream } from 'fs'
import { resolve } from 'path'

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

import { EventScope } from '~/constants/business-event.constant'
import { EventBusEvents } from '~/constants/event-bus.constant'
import { HTTP_REQUEST_TIME } from '~/constants/meta.constant'
import { LOG_DIR } from '~/constants/path.constant'
import { REFLECTOR } from '~/constants/system.constant'
import { isDev } from '~/global/env.global'
import { EventManagerService } from '~/processors/helper/helper.event.service'

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
  constructor(
    @Inject(REFLECTOR) private reflector: Reflector,
    private readonly eventManager: EventManagerService,
  ) {}
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

    const message =
      (exception as any)?.response?.message ||
      (exception as myError)?.message ||
      ''

    const url = request.raw.url!

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      // message && Logger.debug(message, undefined, 'Catch')
      Logger.error(exception, undefined, 'Catch')
      this.eventManager.broadcast(
        EventBusEvents.SystemException,
        {
          message: (exception as Error)?.message,
          stack: (exception as Error)?.stack,
        },
        {
          scope: EventScope.TO_SYSTEM,
        },
      )
      if (!isDev) {
        this.errorLogPipe =
          this.errorLogPipe ??
          fs.createWriteStream(resolve(LOG_DIR, 'error.log'), {
            flags: 'a+',
            encoding: 'utf-8',
          })

        this.errorLogPipe.write(
          `[${new Date().toISOString()}] ${decodeURI(url)}: ${
            (exception as any)?.response?.message ||
            (exception as myError)?.message
          }\n${(exception as Error).stack}\n`,
        )
      }
    } else {
      const ip = getIp(request)
      this.logger.warn(
        `IP: ${ip} 错误信息: (${status}) ${message} Path: ${decodeURI(url)}`,
      )
    }
    // @ts-ignore
    const prevRequestTs = this.reflector.get(HTTP_REQUEST_TIME, request as any)

    if (prevRequestTs) {
      const content = `${request.method} -> ${request.url}`
      Logger.debug(
        `--- 响应异常请求：${content}${chalk.yellow(
          ` +${+new Date() - prevRequestTs}ms`,
        )}`,
        LoggingInterceptor.name,
      )
    }
    const res = (exception as any).response
    response
      .status(status)
      .type('application/json')
      .send({
        ok: 0,
        code: res?.code,
        message: res?.message || (exception as any)?.message || '未知错误',
      })
  }
}
