import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common'
import { Injectable, Logger } from '@nestjs/common'
import { ModuleRef, Reflector } from '@nestjs/core'
import { from, type Observable } from 'rxjs'

import { isDev } from '~/global/env.global'

import {
  SAMPLE_RESPONSE_METADATA,
  type SampleResponseTarget,
} from './sample-response.decorator'

export interface SampleResponseContext {
  query: Record<string, unknown>
  params: Record<string, unknown>
  headers: Record<string, unknown>
  url: string
  method: string
}

interface SampleResponseProvider {
  [key: string]: (ctx: SampleResponseContext) => Promise<unknown> | unknown
}

@Injectable()
export class SampleResponseInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SampleResponseInterceptor.name)

  constructor(
    private readonly reflector: Reflector,
    private readonly moduleRef: ModuleRef,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!isDev) return next.handle()

    const target = this.reflector.get<SampleResponseTarget | undefined>(
      SAMPLE_RESPONSE_METADATA,
      context.getHandler(),
    )
    if (!target) return next.handle()

    let instance: SampleResponseProvider
    try {
      instance = this.moduleRef.get(target.service, {
        strict: false,
      }) as SampleResponseProvider
    } catch (err) {
      this.logger.warn(
        `Sample provider ${target.service.name} not resolvable: ${(err as Error).message}`,
      )
      return next.handle()
    }

    const generator = instance[target.method]
    if (typeof generator !== 'function') {
      this.logger.warn(
        `Sample method ${target.service.name}.${target.method} is not a function`,
      )
      return next.handle()
    }

    const request = context.switchToHttp().getRequest<{
      query?: Record<string, unknown>
      params?: Record<string, unknown>
      headers?: Record<string, unknown>
      url?: string
      method?: string
    }>()

    const ctx: SampleResponseContext = {
      query: request?.query ?? {},
      params: request?.params ?? {},
      headers: request?.headers ?? {},
      url: request?.url ?? '',
      method: request?.method ?? 'GET',
    }

    return from(Promise.resolve(generator.call(instance, ctx)))
  }
}
