/**
 * 对响应体进行 JSON 标准的转换
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
import { Observable, map } from 'rxjs'
import snakecaseKeys from 'snakecase-keys'
import { RESPONSE_PASSTHROUGH_METADATA } from '~/constants/system.constant'

@Injectable()
export class JSONSerializeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const handler = context.getHandler()
    // 跳过 bypass 装饰的请求
    const bypass = this.reflector.get<boolean>(
      RESPONSE_PASSTHROUGH_METADATA,
      handler,
    )
    if (bypass) {
      return next.handle()
    }
    const http = context.switchToHttp()

    if (!http.getRequest()) {
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
      }
      obj = snakecaseKeys(obj)
    }
    return obj
  }
}
