import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common'
import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  Optional,
} from '@nestjs/common'
import { ZodError } from 'zod'

import { EventScope } from '~/constants/business-event.constant'
import { EventBusEvents } from '~/constants/event-bus.constant'
import { ConfigsService } from '~/modules/configs/configs.service'
import { BarkPushService } from '~/processors/helper/helper.bark.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { getIp } from '~/utils/ip.util'

import { BizException } from '../exceptions/biz.exception'
import { AppException, ErrorCodes } from './error.types'

let processHooksRegistered = false

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name)

  constructor(
    @Optional() private readonly eventManager?: EventManagerService,
    @Optional() private readonly barkService?: BarkPushService,
    @Optional() private readonly configService?: ConfigsService,
  ) {
    this.registerProcessHooks()
  }

  private registerProcessHooks() {
    if (processHooksRegistered) return
    processHooksRegistered = true

    process.on('unhandledRejection', (reason: any) => {
      console.error('unhandledRejection:', reason)
    })

    process.on('uncaughtException', (err) => {
      console.error('uncaughtException:', err)
      this.eventManager?.broadcast(
        EventBusEvents.SystemException,
        { message: err?.message ?? err, stack: err?.stack || '' },
        { scope: EventScope.TO_SYSTEM },
      )
    })
  }

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const reply = ctx.getResponse()
    const request = ctx.getRequest()

    if (request?.method === 'OPTIONS') {
      return reply.status(204).send()
    }

    reply.type('application/json')

    const ip = request?.headers ? getIp(request) : undefined
    const url = request?.raw?.url || request?.url || 'Unknown URL'

    if (exception instanceof AppException) {
      const status = exception.getStatus()

      if (status === HttpStatus.TOO_MANY_REQUESTS) {
        this.logger.warn(`IP: ${ip} 疑似遭到攻击 Path: ${decodeURI(url)}`)
        if (this.configService && this.barkService) {
          const { enableThrottleGuard } =
            await this.configService.get('barkOptions')
          if (enableThrottleGuard) {
            this.barkService.throttlePush({
              title: '疑似遭到攻击',
              body: `IP: ${ip} Path: ${decodeURI(url)}`,
            })
          }
        }
      } else if (status >= 500 && !(exception instanceof BizException)) {
        this.logger.error(exception)
        this.eventManager?.broadcast(
          EventBusEvents.SystemException,
          {
            message: exception.message,
            stack: (exception as Error).stack,
          },
          { scope: EventScope.TO_SYSTEM },
        )
      } else {
        this.logger.warn(
          `IP: ${ip} 错误信息：(${status}) ${exception.message} Path: ${decodeURI(url)}`,
        )
      }

      return reply.status(status).send({
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
        },
      })
    }

    if (exception instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: ErrorCodes.VALIDATION_FAILED,
          message: 'Validation failed',
          details: { issues: exception.issues },
        },
      })
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const message = exception.message

      if (status === HttpStatus.TOO_MANY_REQUESTS) {
        this.logger.warn(`IP: ${ip} 疑似遭到攻击 Path: ${decodeURI(url)}`)
        if (this.configService && this.barkService) {
          const { enableThrottleGuard } =
            await this.configService.get('barkOptions')
          if (enableThrottleGuard) {
            this.barkService.throttlePush({
              title: '疑似遭到攻击',
              body: `IP: ${ip} Path: ${decodeURI(url)}`,
            })
          }
        }
        return reply.status(429).send({
          error: {
            code: ErrorCodes.RATE_LIMITED,
            message: '请求过于频繁，请稍后再试',
          },
        })
      }

      if (status >= 500) {
        this.logger.error(exception)
        this.eventManager?.broadcast(
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

      return reply.status(status).send({
        error: { code: ErrorCodes.HTTP_ERROR, message },
      })
    }

    const unknownMessage =
      (exception as Error)?.message || 'Internal server error'

    this.logger.error(exception)
    this.eventManager?.broadcast(
      EventBusEvents.SystemException,
      {
        message: unknownMessage,
        stack: (exception as Error)?.stack,
      },
      { scope: EventScope.TO_SYSTEM },
    )

    return reply.status(500).send({
      error: {
        code: ErrorCodes.INTERNAL_ERROR,
        message: 'Internal server error',
      },
    })
  }
}
