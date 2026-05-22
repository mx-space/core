// https://github.dev/ever-co/ever-gauzy/packages/core/src/core/context/request-context.middleware.ts

import type { ServerResponse } from 'node:http'

import type { NestMiddleware } from '@nestjs/common'
import { Injectable } from '@nestjs/common'

import type { BizIncomingMessage } from '~/transformers/get-req.transformer'
import { normalizeLanguageCode, parseAcceptLanguage } from '~/utils/lang.util'

import { RequestContext } from '../contexts/request.context'

function parseCookieLocale(cookie?: string): string | undefined {
  if (!cookie) return undefined
  const match = cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/)
  return match ? normalizeLanguageCode(match[1]) : undefined
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: BizIncomingMessage, res: ServerResponse, next: () => any) {
    const requestContext = new RequestContext(req, res)

    const skipTranslation = req.headers['x-skip-translation'] === '1'
    const headerLang = req.headers['x-lang']
    const fromHeader =
      typeof headerLang === 'string'
        ? normalizeLanguageCode(headerLang)
        : undefined

    requestContext.lang = skipTranslation
      ? fromHeader
      : fromHeader ||
        parseCookieLocale(req.headers.cookie) ||
        parseAcceptLanguage(req.headers['accept-language']) ||
        undefined

    RequestContext.run(requestContext, () => next())
  }
}
