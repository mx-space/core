import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { RESPONSE_PASSTHROUGH_METADATA } from '~/constants/system.constant'
import { snakecaseKeysWithCompat } from '~/utils/case.util'
import { isObjectLike } from 'es-toolkit/compat'
import { map, Observable } from 'rxjs'

@Injectable()
export class JSONTransformInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const bypass = this.reflector.getAllAndOverride<boolean>(
      RESPONSE_PASSTHROUGH_METADATA,
      [context.getClass(), context.getHandler()],
    )

    if (bypass || !context.switchToHttp().getRequest()) {
      return next.handle()
    }

    return next.handle().pipe(map((data) => this.serialize(data)))
  }

  private serialize(obj: any): any {
    if (!isObjectLike(obj)) {
      return obj
    }

    if (Array.isArray(obj)) {
      return Array.from(obj).map((i) => this.serialize(i))
    }

    if (obj.toJSON || obj.toObject) {
      obj = obj.toJSON?.() ?? obj.toObject?.()
    }

    if (!isObjectLike(obj)) {
      return obj
    }

    Reflect.deleteProperty(obj, '__v')

    for (const key of Object.keys(obj)) {
      const val = obj[key]
      if (!isObjectLike(val)) {
        continue
      }

      if (val.toJSON) {
        obj[key] = val.toJSON()
        if (!isObjectLike(obj[key])) {
          continue
        }
        Reflect.deleteProperty(obj[key], '__v')
      }
      obj[key] = this.serialize(obj[key])
    }

    return snakecaseKeysWithCompat(obj)
  }
}
