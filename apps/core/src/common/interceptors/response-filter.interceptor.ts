/**
 * 对响应体进行数据处理
 * @author Innei
 */
import { isFunction } from 'lodash'
import { map } from 'rxjs'
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common'
import type { Observable } from 'rxjs'

import { Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { HTTP_RESPONSE_FILTER } from '~/constants/meta.constant'

@Injectable()
export class ResponseFilterInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const handler = context.getHandler()

    // 请求数据过滤函数
    const responseFilterFn = this.reflector.getAllAndOverride<boolean>(
      HTTP_RESPONSE_FILTER,
      [handler],
    )

    if (!isFunction(responseFilterFn)) {
      return next.handle()
    }

    const http = context.switchToHttp()
    const request = http.getRequest()

    if (!http.getRequest()) {
      return next.handle()
    }

    return next.handle().pipe(
      map((data) => {
        return responseFilterFn(data, request, handler)
      }),
    )
  }
}
