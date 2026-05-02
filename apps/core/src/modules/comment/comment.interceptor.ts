import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { cloneDeep, isArrayLike, isObjectLike } from 'es-toolkit/compat'
import { map } from 'rxjs'

import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'
import { getAvatar } from '~/utils/tool.util'
import { isDefined } from '~/utils/validator.util'

@Injectable()
export class CommentFilterEmailInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = this.getRequest(context)
    // 如果已经登陆
    const isAuthenticated = request.user
    if (isAuthenticated) {
      return next.handle()
    }
    return next.handle().pipe(
      map(function handle(data: any) {
        if (!data) {
          return data
        }
        try {
          if (isArrayLike(data?.data)) {
            data?.data?.forEach((item: any, i: number) => {
              // persistence model -> object
              data.data[i] = data.data[i].toObject?.() || data.data[i]
              if (isDefined(item.mail)) {
                data.data[i].avatar = getAvatar(item.mail)
                delete data.data[i].mail
              }
              if (item.replies) {
                handle({ data: data.data[i].replies })
              }
            })
          }

          if (isObjectLike(data)) {
            data = data?.toJSON?.() || data

            Reflect.deleteProperty(data, 'mail')
          }

          return cloneDeep(data)
        } catch (error) {
          if (isDev) {
            console.error(error)
          }
          return cloneDeep(data)
        }
      }),
    )
  }

  get getRequest() {
    return getNestExecutionContextRequest.bind(this)
  }
}
