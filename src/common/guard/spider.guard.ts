/**
 * @module common/guard/spider.guard
 * @description 禁止爬虫的守卫
 * @author Innei <https://innei.ren>
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
