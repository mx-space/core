/*
 * @Author: Innei
 * @Date: 2020-11-24 16:20:37
 * @LastEditTime: 2021-03-21 20:12:56
 * @LastEditors: Innei
 * @FilePath: /server/shared/core/interceptors/response.interceptors.ts
 * Mark: Coding with Love
 */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnprocessableEntityException,
} from '@nestjs/common'
import { isArrayLike, isObjectLike } from 'lodash'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

import snakecaseKeys from 'snakecase-keys'

export interface Response<T> {
  data: T
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const reorganize = (data) => {
      if (!data) {
        throw new UnprocessableEntityException('数据丢失了(｡ ́︿ ̀｡)')
      }
      return typeof data !== 'object' || data.__proto__.constructor === Object
        ? { ...data }
        : { data }
    }
    return next.handle().pipe(
      map((data) =>
        typeof data === 'undefined'
          ? // HINT: hack way to solve `undefined` as cache value set into redis got an error.
            ''
          : typeof data === 'object' && data !== null
          ? { ...reorganize(data) }
          : data,
      ),
    )
  }
}

export class JSONSerializeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        return this.serialize(data)
      }),
    )
  }

  private serialize(obj: any) {
    if (!isObjectLike(obj)) {
      return obj
    }

    if (isArrayLike(obj)) {
      obj = Array.from(obj).map((i) => {
        return this.serialize(i)
      })
    } else {
      // if is Object

      if (obj.toJSON || obj.toObject) {
        obj = obj.toJSON?.() ?? obj.toObject?.()
      }

      const keys = Object.keys(obj)
      for (const key of keys) {
        const val = obj[key]
        // first
        if (!isObjectLike(val)) {
          continue
        }

        if (val.toJSON) {
          obj[key] = val.toJSON()
          // second
          if (!isObjectLike(obj[key])) {
            continue
          }
        }
        obj[key] = this.serialize(obj[key])
        // obj[key] = snakecaseKeys(obj[key])
      }
      obj = snakecaseKeys(obj)
      delete obj.v
    }
    return obj
  }
}
