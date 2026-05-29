import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type { IRequestHandler, RequestProxyResult } from '~/interfaces/request'
import type { EnrichmentResult } from '~/models/enrichment'
import { autoBind } from '~/utils/auto-bind'

import type { HTTPClient } from '../core'

declare module '@mx-space/api-client' {
  interface HTTPClient<
    T extends IRequestAdapter = IRequestAdapter,
    ResponseWrapper = unknown,
  > {
    enrichment: EnrichmentController<ResponseWrapper>
  }
}

export class EnrichmentController<ResponseWrapper> implements IController {
  base = 'enrichment'
  name = 'enrichment'

  constructor(private client: HTTPClient) {
    autoBind(this)
  }

  public get proxy(): IRequestHandler<ResponseWrapper> {
    return this.client.proxy(this.base)
  }

  resolveByUrl(
    url: string,
  ): RequestProxyResult<EnrichmentResult | null, ResponseWrapper> {
    return this.proxy.resolve.get<EnrichmentResult | null>({
      params: { url },
    })
  }
}
