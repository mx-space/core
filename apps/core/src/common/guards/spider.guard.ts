import type { CanActivate, ExecutionContext } from '@nestjs/common'
import { ForbiddenException, Injectable } from '@nestjs/common'
import { isDev } from '~/global/env.global'
import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'

@Injectable()
export class SpiderGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (isDev) {
      return true
    }

    const request = getNestExecutionContextRequest(context)
    const ua: string = request.headers['user-agent'] || ''
    const isSpiderUA =
      !!/scrapy|httpclient|axios|python|requests/i.test(ua) &&
      !/mx-space|rss|google|baidu|bing/i.test(ua)
    if (ua && !isSpiderUA) {
      return true
    }
    throw new ForbiddenException(`爬虫是被禁止的哦，UA: ${ua}`)
  }
}
