import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

import {
  BYPASS_CASE_TRANSFORM_ROOT,
  transformResponseCase,
} from '~/common/response/case-transform'
import {
  isExplicitSuccessEnvelope,
  type SuccessEnvelope,
} from '~/common/response/envelope.types'
import {
  BYPASS_CASE_TRANSFORM_METADATA,
  RESPONSE_PASSTHROUGH_METADATA,
} from '~/constants/system.constant'

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp()
    if (!http.getRequest()) {
      return next.handle()
    }

    const passthrough = this.reflector.getAllAndOverride<boolean>(
      RESPONSE_PASSTHROUGH_METADATA,
      [context.getClass(), context.getHandler()],
    )
    if (passthrough) {
      return next.handle()
    }

    const bypassMetadata = this.reflector.getAllAndOverride<string[]>(
      BYPASS_CASE_TRANSFORM_METADATA,
      [context.getHandler(), context.getClass()],
    )
    const bypassPaths = Array.isArray(bypassMetadata) ? bypassMetadata : []

    return next.handle().pipe(
      map((data) => {
        if (typeof data === 'undefined') {
          http.getResponse().status(204)
          return data
        }
        const envelope: SuccessEnvelope = isExplicitSuccessEnvelope(data)
          ? data
          : { data }
        const result: SuccessEnvelope = {
          data: transformResponseCase(envelope.data, bypassPaths),
        }
        if (envelope.meta !== undefined) {
          result.meta = transformResponseCase(
            envelope.meta,
            bypassPaths.includes(BYPASS_CASE_TRANSFORM_ROOT)
              ? [BYPASS_CASE_TRANSFORM_ROOT]
              : [],
          ) as SuccessEnvelope['meta']
        }
        return result
      }),
    )
  }
}
