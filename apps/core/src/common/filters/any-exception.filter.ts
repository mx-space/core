import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common'
import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'

import { AppException } from '~/common/response/error.types'
import { EventScope } from '~/constants/business-event.constant'
import { EventBusEvents } from '~/constants/event-bus.constant'
import { ConfigsService } from '~/modules/configs/configs.service'
import { BarkPushService } from '~/processors/helper/helper.bark.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'

import { getIp } from '../../utils/ip.util'

interface ErrorLike {
  readonly status?: number | string
  readonly statusCode?: number
  readonly message?: string
}

const isHttpStatusCode = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 100 &&
  value <= 599

let once = false

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  constructor(
    private readonly eventManager: EventManagerService,
    private readonly barkService: BarkPushService,
    private readonly configService: ConfigsService,
  ) {
    this.registerCatchAllExceptionsHook()
  }

  private registerCatchAllExceptionsHook() {
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
        { scope: EventScope.TO_SYSTEM },
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
    const errorLike = exception as ErrorLike | undefined
    const rawStatus = errorLike?.status
    const rawStatusCode = errorLike?.statusCode
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : isHttpStatusCode(rawStatus)
          ? rawStatus
          : isHttpStatusCode(rawStatusCode)
            ? rawStatusCode
            : HttpStatus.INTERNAL_SERVER_ERROR

    const message =
      (exception as any)?.response?.message ||
      (exception as ErrorLike)?.message ||
      ''
    const url = request.raw?.url || request.url || 'Unknown URL'

    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      this.logger.warn(`IP: ${ip} 疑似遭到攻击 Path: ${decodeURI(url)}`)

      const { enableThrottleGuard } =
        await this.configService.get('barkOptions')
      if (enableThrottleGuard) {
        this.barkService.throttlePush({
          title: '疑似遭到攻击',
          body: `IP: ${ip} Path: ${decodeURI(url)}`,
        })
      }

      return response.status(429).send({
        message: '请求过于频繁，请稍后再试',
      })
    }

    if (
      status === HttpStatus.INTERNAL_SERVER_ERROR &&
      !(exception instanceof AppException)
    ) {
      this.logger.error(exception)
      this.eventManager.broadcast(
        EventBusEvents.SystemException,
        {
          message: (exception as Error)?.message,
          stack: (exception as Error)?.stack,
        },
        { scope: EventScope.TO_SYSTEM },
      )
    } else {
      this.logger.warn(
        `IP: ${ip} 错误信息：(${status}) ${message} Path: ${decodeURI(url)}`,
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
