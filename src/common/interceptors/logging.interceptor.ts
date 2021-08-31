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
    SetMetadata(HTTP_REQUEST_TIME, now)(context.switchToHttp().getRequest())

    return call$.pipe(
      tap(() =>
        this.logger.debug(
          '--- 响应请求：' + content + ` +${+new Date() - now}ms`,
        ),
      ),
    )
  }
}
