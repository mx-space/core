import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { isDefined } from 'class-validator'
import { isArrayLike, isObjectLike } from 'lodash'
import { map } from 'rxjs'
import { getNestExecutionContextRequest } from '~/utils/nest.util'
@Injectable()
export class CommentFilterEmailInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = this.getRequest(context)
    // 如果已经登陆
    const isMaster = request.user
    if (isMaster) {
      return next.handle()
    }
    return next.handle().pipe(
      map(function handle(data: any) {
        if (!data) {
          return data
        }

        if (isArrayLike(data?.data)) {
          ;(data?.data).forEach((item: any, i) => {
            if (isDefined(item.mail)) {
              data.data[i].mail = '*'
            }
            if (item.children) {
              handle({ data: item.children })
            }
          })
        }

        if (isObjectLike(data)) {
          data = data?.toJSON?.() || data
          Reflect.deleteProperty(data, 'mail')
        }
        return data
      }),
    )
  }

  get getRequest() {
    return getNestExecutionContextRequest.bind(this)
  }
}
