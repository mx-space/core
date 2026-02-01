import type { ExecutionContext } from '@nestjs/common'
import { createParamDecorator } from '@nestjs/common'
import { RequestContext } from '~/common/contexts/request.context'
import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'
import { normalizeLanguageCode } from '~/utils/lang.util'

/**
 * Get the language parameter from the request.
 * Priority: query.lang > header['x-lang']
 */
export const Lang = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = getNestExecutionContextRequest(ctx)

    // Priority 1: query parameter
    const query = request.query as Record<string, unknown>
    const queryLang = query?.lang
    if (typeof queryLang === 'string') {
      const normalized = normalizeLanguageCode(queryLang)
      if (normalized) return normalized
    }

    // Priority 2: header (already normalized in middleware)
    return RequestContext.currentLang()
  },
)
