/**
 * 对响应体进行转换结构
 * @author Innei
 */
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { HTTP_RES_TRANSFORM_PAGINATE } from '~/constants/meta.constant'
import * as SYSTEM from '~/constants/system.constant'
import { transformDataToPaginate } from '~/transformers/paginate.transformer'
import { isArrayLike } from 'lodash'
import type { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

export interface Response<T> {
  data: T
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  constructor(private readonly reflector: Reflector) {}
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    if (!context.switchToHttp().getRequest()) {
      return next.handle()
    }
    const handler = context.getHandler()
    const classType = context.getClass()

    // 跳过 bypass 装饰的请求
    const bypass = this.reflector.getAllAndOverride<boolean>(
      SYSTEM.RESPONSE_PASSTHROUGH_METADATA,
      [classType, handler],
    )
    if (bypass) {
      return next.handle()
    }

    return next.handle().pipe(
      map((data) => {
        if (typeof data === 'undefined') {
          context.switchToHttp().getResponse().status(204)
          return data
        }
        // 分页转换
        if (this.reflector.get(HTTP_RES_TRANSFORM_PAGINATE, handler)) {
          return transformDataToPaginate(data)
        }

        return isArrayLike(data) ? { data } : data
      }),
    )
  }
}
