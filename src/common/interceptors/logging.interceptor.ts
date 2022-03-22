/**
 * Logging interceptor.
 * @file 日志拦截器
 * @module interceptor/logging
 * @author Surmon <https://github.com/surmon-china>
 * @author Innei <https://github.com/Innei>
 */

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import { HTTP_REQUEST_TIME } from '~/constants/meta.constant'
import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private logger: Logger
  constructor() {
    this.logger = new Logger(LoggingInterceptor.name, { timestamp: false })
  }
  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> {
    const call$ = next.handle()
    const request = this.getRequest(context)
    const content = `${request.method} -> ${request.url}`
    this.logger.debug(`+++ 收到请求：${content}`)
    const now = +new Date()
    SetMetadata(HTTP_REQUEST_TIME, now)(this.getRequest(context) as any)

    return call$.pipe(
      tap(() =>
        this.logger.debug(
          `--- 响应请求：${content}${chalk.yellow(` +${+new Date() - now}ms`)}`,
        ),
      ),
    )
  }

  getRequest(context: ExecutionContext) {
    return getNestExecutionContextRequest(context)
  }
}
