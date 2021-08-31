import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { FastifyReply, FastifyRequest } from 'fastify'
import { isDev } from '~/utils/index.util'
import { getIp } from '../../utils/ip.util'
import { writeFileSync } from 'fs'
import { LOGGER_DIR } from '~/constants/path.constant'
import { resolve } from 'path'
type myError = {
  readonly status: number
  readonly statusCode?: number

  readonly message?: string
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('捕获异常')
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
        } \n ${(exception as Error).stack || ''} \n`,
        { encoding: 'utf-8', flag: 'a+' },
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
