import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import qs from 'qs'

import {
  getNestExecutionContextRequest,
  isHttpExecutionContext,
} from '~/transformers/get-req.transformer'

@Injectable()
export class DbQueryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler<any>) {
    if (!isHttpExecutionContext(context)) {
      return next.handle()
    }

    const request = getNestExecutionContextRequest(context)
    const query = request.query as any

    if (query) {
      const queryObj = query.db_query

      if (request.user) {
        query.db_query =
          typeof queryObj === 'string' ? qs.parse(queryObj) : queryObj
      } else {
        delete query.db_query
      }
    }

    return next.handle()
  }
}
