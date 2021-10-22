/**
 * 把 URL Search 上的 `token` 附加到 Header Authorization 上
 * @author Innei <https://innei.ren>
 */

import { Injectable, NestMiddleware } from '@nestjs/common'
import { IncomingMessage, ServerResponse } from 'http'
import { parseRelativeUrl } from '~/utils/ip.util'

@Injectable()
export class AttachHeaderTokenMiddleware implements NestMiddleware {
  async use(req: IncomingMessage, res: ServerResponse, next: () => void) {
    // @ts-ignore
    const url = req.originalUrl?.replace(/^\/api(\/v\d)?/, '')
    const parser = parseRelativeUrl(url)

    if (parser.searchParams.get('token')) {
      req.headers.authorization = parser.searchParams.get('token')
    }

    next()
  }
}
