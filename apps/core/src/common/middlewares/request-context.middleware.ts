// https://github.dev/ever-co/ever-gauzy/packages/core/src/core/context/request-context.middleware.ts

import type { ServerResponse } from 'node:http'
import type { NestMiddleware } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import type { BizIncomingMessage } from '~/transformers/get-req.transformer'
import { normalizeLanguageCode } from '~/utils/lang.util'
import { RequestContext } from '../contexts/request.context'

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: BizIncomingMessage, res: ServerResponse, next: () => any) {
    const requestContext = new RequestContext(req, res)

    // Extract x-lang header and normalize
    const headerLang = req.headers['x-lang']
    if (typeof headerLang === 'string') {
      requestContext.lang = normalizeLanguageCode(headerLang)
    }

    RequestContext.run(requestContext, () => next())
  }
}
