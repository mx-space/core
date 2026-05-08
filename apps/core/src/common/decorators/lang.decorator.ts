import type { ExecutionContext } from '@nestjs/common'
import { createParamDecorator } from '@nestjs/common'

import { RequestContext } from '~/common/contexts/request.context'
import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'
import { resolveRequestedLanguage } from '~/utils/lang.util'

/**
 * Get the language parameter from the request.
 * Priority: query.lang > header['x-lang']
 *
 * Side effect: when query.lang outranks the header-derived
 * `RequestContext.lang` (set by `RequestContextMiddleware`), write the
 * resolved value back into the context so downstream services that don't
 * receive `lang` as an argument — most notably
 * `EnrichmentService.attachEnrichments`, which reads
 * `RequestContext.currentLang()` for SSR enrichment hydration — see the
 * same locale the controller does. Without this, callers like Yohaku web
 * that send `?lang=ja` without an `x-lang` header would render the
 * controller body in Japanese while the inline link-card map stayed
 * Chinese.
 */
export const Lang = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = getNestExecutionContextRequest(ctx)
    const query = request.query as Record<string, unknown>

    const resolved = resolveRequestedLanguage(
      query?.lang,
      RequestContext.currentLang(),
    )

    const ctxStore = RequestContext.currentRequestContext()
    if (ctxStore && resolved && ctxStore.lang !== resolved) {
      ctxStore.lang = resolved
    }

    return resolved
  },
)
