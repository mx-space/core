import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { isObjectLike } from 'es-toolkit/compat'
import { map, Observable } from 'rxjs'

import { RESPONSE_PASSTHROUGH_METADATA } from '~/constants/system.constant'
import { snakecaseKeysWithCompat } from '~/utils/case.util'

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

    // Skip key conversion for URL-keyed maps (e.g. `enrichments`): the keys
    // ARE the URLs and must round-trip verbatim so SSR consumers can look
    // up entries by the original href. Inner values still get camel→snake
    // recursion since snakecase-keys descends with deep:true by default.
    return snakecaseKeysWithCompat(obj, { exclude: [/^https?:\/\//i] })
  }
}
