import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common'
import { Injectable, Logger, SetMetadata } from '@nestjs/common'
import { HTTP_REQUEST_TIME } from '~/constants/meta.constant'
import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'
import pc from 'picocolors'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name, {
    timestamp: false,
  })

  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> {
    const request = getNestExecutionContextRequest(context)
    const content = `${request.method} -> ${request.url}`
    this.logger.debug(`+++ 收到请求：${content}`)
    const now = Date.now()

    SetMetadata(HTTP_REQUEST_TIME, now)(request as any)

    return next
      .handle()
      .pipe(
        tap(() =>
          this.logger.debug(
            `--- 响应请求：${content}${pc.yellow(` +${Date.now() - now}ms`)}`,
          ),
        ),
      )
  }
}
