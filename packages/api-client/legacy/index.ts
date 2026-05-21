import type { HTTPClient } from '~/index'
import { createClient } from '~/index'
import type { IRequestAdapter } from '~/interfaces/adapter'
import type { ClientOptions } from '~/interfaces/client'

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

export function createLegacyApiClient<T extends IRequestAdapter>(
  adapter: T,
  legacyOptions?: LegacyResponseAdapterOptions,
): <
  ResponseWrapper = T extends { responseWrapper: infer Type }
    ? Type extends undefined
      ? unknown
      : Type
    : unknown,
>(endpoint: string, options?: ClientOptions) => HTTPClient<T, ResponseWrapper> {
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

    return create<ResponseWrapper>(endpoint, {
      ...options,
      responseAdapter,
    })
  }
}
