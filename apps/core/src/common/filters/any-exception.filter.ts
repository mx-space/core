import { createWriteStream } from 'node:fs'
import type { WriteStream } from 'node:fs'
import { resolve } from 'node:path'
import { chalk } from '@mx-space/compiled'
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common'
import {
  Catch,
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
import { ConfigsService } from '~/modules/configs/configs.service'
import { BarkPushService } from '~/processors/helper/helper.bark.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { getIp } from '../../utils/ip.util'
import { BizException } from '../exceptions/biz.exception'
import { LoggingInterceptor } from '../interceptors/logging.interceptor'

type myError = {
  readonly status: number
  readonly statusCode?: number

  readonly message?: string
}

let once = false
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)
  private errorLogPipe: WriteStream
  constructor(
    @Inject(REFLECTOR) private reflector: Reflector,
    private readonly eventManager: EventManagerService,
    private readonly barkService: BarkPushService,
    private readonly configService: ConfigsService,
  ) {
    this.registerCatchAllExceptionsHook()
  }

  registerCatchAllExceptionsHook() {
    if (once) {
      return
    }
    process.on('unhandledRejection', (reason: any) => {
      console.error('unhandledRejection:', reason)
    })

    process.on('uncaughtException', (err) => {
      console.error('uncaughtException:', err)
      this.eventManager.broadcast(
        EventBusEvents.SystemException,
        { message: err?.message ?? err, stack: err?.stack || '' },
        {
          scope: EventScope.TO_SYSTEM,
        },
      )
    })
    once = true
  }

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<FastifyReply>()
    const request = ctx.getRequest<FastifyRequest>()

    if (request.method === 'OPTIONS') return response.status(204).send()
    const ip = getIp(request)

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
    const url = request.raw?.url || request.url || 'Unknown URL'
    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      this.logger.warn(`IP: ${ip} 疑似遭到攻击 Path: ${decodeURI(url)}`)

      const { enableThrottleGuard } =
        await this.configService.get('barkOptions')
      if (enableThrottleGuard)
        this.barkService.throttlePush({
          title: '疑似遭到攻击',
          body: `IP: ${ip} Path: ${decodeURI(url)}`,
        })

      return response.status(429).send({
        message: '请求过于频繁，请稍后再试',
      })
    }

    if (
      status === HttpStatus.INTERNAL_SERVER_ERROR &&
      !(exception instanceof BizException)
    ) {
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
          createWriteStream(resolve(LOG_DIR, 'error.log'), {
            flags: 'a+',
            encoding: 'utf-8',
          })

        this.errorLogPipe.write(
          `[${new Date().toLocaleString('en-US', {
            timeStyle: 'medium',
            dateStyle: 'long',
          })}] ${decodeURI(url)}: ${
            (exception as any)?.response?.message ||
            (exception as myError)?.message
          }\n${(exception as Error).stack}\n`,
        )
      }
    } else {
      this.logger.warn(
        `IP: ${ip} 错误信息：(${status}) ${message} Path: ${decodeURI(url)}`,
      )
    }
    // @ts-ignore
    const prevRequestTs = this.reflector.get(HTTP_REQUEST_TIME, request as any)

    if (prevRequestTs) {
      const content = `${request.method} -> ${request.url}`
      Logger.debug(
        `--- 响应异常请求：${content}${chalk.yellow(
          ` +${Date.now() - prevRequestTs}ms`,
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
