/**
 * 对响应体进行转换结构
 * @author Innei
 */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { isArrayLike, isObjectLike } from 'lodash'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import snakecaseKeys from 'snakecase-keys'
import { HTTP_RES_TRANSFORM_PAGINATE } from '~/constants/meta.constant'
import * as SYSTEM from '~/constants/system.constant'
import { transformDataToPaginate } from '~/utils/transfrom.util'

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

    // 跳过 bypass 装饰的请求
    const bypass = this.reflector.get<boolean>(
      SYSTEM.RESPONSE_PASSTHROUGH_METADATA,
      handler,
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

export class JSONSerializeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!context.switchToHttp().getRequest()) {
      return next.handle()
    }

    return next.handle().pipe(
      map((data) => {
        return this.serialize(data)
      }),
    )
  }

  private serialize(obj: any) {
    if (!isObjectLike(obj)) {
      return obj
    }

    if (isArrayLike(obj)) {
      obj = Array.from(obj).map((i) => {
        return this.serialize(i)
      })
    } else {
      // if is Object
      if (obj.toJSON || obj.toObject) {
        obj = obj.toJSON?.() ?? obj.toObject?.()
      }

      Reflect.deleteProperty(obj, '__v')

      const keys = Object.keys(obj)
      for (const key of keys) {
        const val = obj[key]
        // first
        if (!isObjectLike(val)) {
          continue
        }

        if (val.toJSON) {
          obj[key] = val.toJSON()
          // second
          if (!isObjectLike(obj[key])) {
            continue
          }
          Reflect.deleteProperty(obj[key], '__v')
        }
        obj[key] = this.serialize(obj[key])
        // obj[key] = snakecaseKeys(obj[key])
      }
      obj = snakecaseKeys(obj)
      // delete obj.v
    }
    return obj
  }
}
