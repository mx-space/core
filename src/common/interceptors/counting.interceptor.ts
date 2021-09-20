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
import { getNestExecutionContextRequest } from '~/utils/nest.util'
// ResponseInterceptor -> JSONSerializeInterceptor -> CountingInterceptor -> HttpCacheInterceptor
@Injectable()
export class CountingInterceptor<T> implements NestInterceptor<T, any> {
  constructor(
    private readonly countingService: CountingService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = this.getRequest(context)

    // 有登录态跳过更新计数
    if (request.isMaster) {
      return next.handle()
    }
    const handler = context.getHandler()
    return next.handle().pipe(
      map((data) => {
        // 计数处理
        const documentType = this.reflector.get(
          HTTP_RES_UPDATE_DOC_COUNT_TYPE,
          handler,
        )
        if (documentType && data) {
          this.countingService.updateReadCount(
            documentType as any,
            // _id 兼容 GQL 不过 JSONSerializeInterceptor ResponseInterceptor 转换
            data.id || data?.data?.id || data._id || data?.data?._id,
            getIp(this.getRequest(context)),
          )
        }

        return data
      }),
    )
  }

  get getRequest() {
    return getNestExecutionContextRequest.bind(this)
  }
}
