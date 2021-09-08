/**
 * 处理 Article 类型响应, 增加计数
 * @author Innei
 */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { map } from 'rxjs'
import { HTTP_RES_UPDATE_DOC_COUNT_TYPE } from '~/constants/meta.constant'
import { CountingService } from '~/processors/helper/helper.counting.service'
import { getIp } from '~/utils/ip.util'
import { getNestExectionContextRequest } from '~/utils/nest.util'
// ResponseInterceptor -> JSONSerializeInterceptor -> CountingInterceptor -> HttpCacheInterceptor
@Injectable()
export class CountingInterceptor<T> implements NestInterceptor<T, any> {
  constructor(
    private readonly countingService: CountingService,
    private readonly reflector: Reflector,
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
        if (documentType) {
          this.countingService.updateReadCount(
            documentType as any,
            data.id || data?.data?.id,
            getIp(this.getRequest(context)),
          )
        }

        return data
      }),
    )
  }

  get getRequest() {
    return getNestExectionContextRequest.bind(this)
  }
}
