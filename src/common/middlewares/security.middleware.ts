import { Injectable, NestMiddleware } from '@nestjs/common'
import { IncomingMessage, ServerResponse } from 'http'
import { parseRelativeUrl } from '~/utils/ip.util'
// 用于屏蔽 PHP 的请求

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  async use(req: IncomingMessage, res: ServerResponse, next: () => void) {
    // @ts-ignore
    const url = parseRelativeUrl(req.originalUrl).pathname

    if (url.match(/\.php$/g)) {
      res.statusMessage =
        'Eh. PHP is not support on this machine. Yep, I also think PHP is bestest programming language. But for me it is beyond my reach.'
      return res.writeHead(666).end()
    } else if (url.match(/\/(adminer|admin|wp-login)$/g)) {
      res.statusMessage = 'Hey, What the fuck are you doing!'
      return res.writeHead(200).end()
    } else next()
  }
}
