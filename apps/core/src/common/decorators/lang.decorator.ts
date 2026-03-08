import type { ExecutionContext } from '@nestjs/common'
import { createParamDecorator } from '@nestjs/common'

import { RequestContext } from '~/common/contexts/request.context'
import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'
import { resolveRequestedLanguage } from '~/utils/lang.util'

/**
 * Get the language parameter from the request.
 * Priority: query.lang > header['x-lang']
 */
export const Lang = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = getNestExecutionContextRequest(ctx)
    const query = request.query as Record<string, unknown>

    return resolveRequestedLanguage(query?.lang, RequestContext.currentLang())
  },
)
