/**
 * Logging interceptor.
 * @file 日志拦截器
 * @module interceptor/logging
 * @author Surmon <https://github.com/surmon-china>
 */

import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import {
  Injectable,
  NestInterceptor,
  CallHandler,
  ExecutionContext,
  Logger,
} from '@nestjs/common'
import { isDev } from '~/utils/index.util'

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private logger: Logger

  constructor() {
    this.logger = new Logger(LoggingInterceptor.name)
  }
  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> {
    const call$ = next.handle()
    if (!isDev) {
      return call$
    }
    const request = context.switchToHttp().getRequest()
    const content = request.method + ' -> ' + request.url
    Logger.debug('+++ 收到请求：' + content, LoggingInterceptor.name)
    const now = +new Date()

    return call$.pipe(
      tap(() =>
        this.logger.debug(
          '--- 响应请求：' + content + ` +${+new Date() - now}ms`,
        ),
      ),
    )
  }
}
