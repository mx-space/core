import type { HTTPClient } from '~/index'
import { createClient } from '~/index'
import type { IRequestAdapter } from '~/interfaces/adapter'
import type { ClientOptions } from '~/interfaces/client'
import { isPlainObject } from '~/utils'

import {
  legacyResponseAdapter,
  type LegacyResponseAdapterOptions,
} from './response-adapter'

export { legacyResponseAdapter }
export type {
  LegacyResponseAdapterMatcher,
  LegacyResponseAdapterOptions,
} from './response-adapter'
export type { LegacyPager, LegacyPaginateResult } from './types'

// V1 → V3 alias map for `sortBy` query params. V1 callers used the short
// `created` / `modified` names; V3 backends only accept the `*At` variants.
// Translating here keeps host code untouched during the migration.
const SORT_BY_LEGACY_ALIAS: Record<string, string> = {
  created: 'createdAt',
  modified: 'modifiedAt',
}

interface RequestEnvelope {
  url: string
  method?: string
  data?: unknown
  params?: unknown
  [k: string]: unknown
}

function rewriteLegacyRequestEnvelope(
  options: RequestEnvelope,
): RequestEnvelope {
  const params = options.params
  if (!isPlainObject(params)) return options
  const sortBy = (params as Record<string, unknown>).sortBy
  if (typeof sortBy !== 'string' || !(sortBy in SORT_BY_LEGACY_ALIAS)) {
    return options
  }
  return {
    ...options,
    params: {
      ...(params as Record<string, unknown>),
      sortBy: SORT_BY_LEGACY_ALIAS[sortBy],
    },
  }
}

export function createLegacyApiClient<T extends IRequestAdapter>(
  adapter: T,
  legacyOptions?: LegacyResponseAdapterOptions,
): <
  ResponseWrapper = T extends { responseWrapper: infer Type }
    ? Type extends undefined
      ? unknown
      : Type
    : unknown,
>(
  endpoint: string,
  options?: ClientOptions,
) => HTTPClient<T, ResponseWrapper> {
  const create = createClient(adapter)

  return <
    ResponseWrapper = T extends { responseWrapper: infer Type }
      ? Type extends undefined
        ? unknown
        : Type
      : unknown,
  >(
    endpoint: string,
    options: ClientOptions = {},
  ) => {
    const responseAdapter = options.responseAdapter
      ? [
          legacyResponseAdapter(legacyOptions),
          ...(Array.isArray(options.responseAdapter)
            ? options.responseAdapter
            : [options.responseAdapter]),
        ]
      : legacyResponseAdapter(legacyOptions)

    const client = create<ResponseWrapper>(endpoint, {
      ...options,
      responseAdapter,
    })

    // Rewrite outgoing request params at the manager.request boundary —
    // `attach-request`'s $$get strips `params` into the URL query before
    // calling the host adapter, so wrapping the adapter itself can't see
    // GET params. Patching `request` keeps the hook in one place for all
    // methods (GET/POST/PUT/PATCH/DELETE).
    const origRequest = client.request.bind(client)
    ;(client as { request: (o: RequestEnvelope) => unknown }).request = (o) =>
      origRequest(rewriteLegacyRequestEnvelope(o) as any)

    return client
  }
}
