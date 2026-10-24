import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { map } from 'rxjs'

import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'
import { getAvatar } from '~/utils/tool.util'

import { CommentViews } from './comment.views'

@Injectable()
export class CommentFilterEmailInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = this.getRequest(context)
    if (request.hasAdminAccess ?? request.isAuthenticated) return next.handle()
    return next.handle().pipe(map((data) => this.projectPublic(data)))
  }

  private projectPublic(value: any): any {
    if (!value || typeof value !== 'object' || value instanceof Date)
      return value
    if (Array.isArray(value))
      return value.map((item) => this.projectPublic(item))
    if ('id' in value && 'text' in value && 'refType' in value) {
      return CommentViews.public.parse({
        ...value,
        avatar: value.avatar || (value.mail ? getAvatar(value.mail) : null),
        replies: value.replies?.map((item: any) => this.projectPublic(item)),
        children: value.children?.map((item: any) => this.projectPublic(item)),
        parent: value.parent,
      })
    }
    // Keep the explicit-envelope symbol and pagination metadata intact.
    for (const key of Object.keys(value))
      value[key] = this.projectPublic(value[key])
    return value
  }

  get getRequest() {
    return getNestExecutionContextRequest.bind(this)
  }
}
