import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'
import qs from 'qs'
import type { Observable } from 'rxjs'

/** 此拦截器用于转换 req.query.query -> js object，用于直接数据库查询，需要鉴权  */
@Injectable()
export class DbQueryInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    const request = getNestExecutionContextRequest(context)
    const query = request.query as any

    if (!query) {
      return next.handle()
    }

    const queryObj = query.db_query

    if (request.user) {
      ;(request.query as any).db_query =
        typeof queryObj === 'string' ? qs.parse(queryObj) : queryObj
    } else {
      delete (request.query as any).db_query
    }

    return next.handle()
  }
}
