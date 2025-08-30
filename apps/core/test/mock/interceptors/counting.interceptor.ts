import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common'
import { Inject, Injectable } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import { HTTP_RES_UPDATE_DOC_COUNT_TYPE } from '~/constants/meta.constant'
import { REFLECTOR } from '~/constants/system.constant'
import { CountingService } from '~/processors/helper/helper.counting.service'
import { map } from 'rxjs'

@Injectable()
export class MockingCountingInterceptor<T> implements NestInterceptor<T> {
  constructor(
    @Inject(REFLECTOR) private readonly reflector: Reflector,
    @Inject(CountingService)
    private readonly countingService: CountingService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const handler = context.getHandler()
    return next.handle().pipe(
      map((data) => {
        // 计数处理
        const documentType = this.reflector.get(
          HTTP_RES_UPDATE_DOC_COUNT_TYPE,
          handler,
        )
        if (documentType && data) {
          // @ts-ignore
          this.countingService.updateReadCount()
        }

        return data
      }),
    )
  }
}
