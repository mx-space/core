/*
 * @Author: Innei
 * @Date: 2020-04-30 19:09:37
 * @LastEditTime: 2020-07-08 21:35:06
 * @LastEditors: Innei
 * @FilePath: /mx-server/src/core/guards/spider.guard.ts
 * @Coding with Love
 */

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { FastifyRequest } from 'fastify'
import { Observable } from 'rxjs'
import { isDev } from '~/utils/index.util'

@Injectable()
export class SpiderGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    if (isDev) {
      return true
    }
    const http = context.switchToHttp()
    const request = http.getRequest<FastifyRequest>()
    const headers = request.headers
    const ua: string = headers['user-agent'] || ''
    const isSpiderUA = !!ua.match(/(Scrapy|Curl|HttpClient|python|requests)/i)
    if (ua && !isSpiderUA) {
      return true
    }
    throw new ForbiddenException('爬虫, 禁止')
  }
}
