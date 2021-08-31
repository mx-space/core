import { Injectable, NestMiddleware } from '@nestjs/common'
import { IncomingMessage, ServerResponse } from 'http'
import { parseRelativeUrl } from '~/utils/ip.util'

@Injectable()
export class SkipBrowserDefaultRequestMiddleware implements NestMiddleware {
  async use(req: IncomingMessage, res: ServerResponse, next: () => void) {
    // @ts-ignore
    const url = parseRelativeUrl(req.originalUrl).pathname

    if (url.match(/favicon.ico$/) || url.match(/manifest.json$/)) {
      res.writeHead(204)
      return res.end()
    }
    next()
  }
}
