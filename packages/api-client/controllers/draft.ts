import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type { IRequestHandler } from '~/interfaces/request'
import type { SharedDraftModel } from '~/models/draft'
import { autoBind } from '~/utils/auto-bind'

import type { HTTPClient } from '../core'

declare module '@mx-space/api-client' {
  interface HTTPClient<
    T extends IRequestAdapter = IRequestAdapter,
    ResponseWrapper = unknown,
  > {
    draft: DraftController<ResponseWrapper>
  }
}

export class DraftController<ResponseWrapper> implements IController {
  base = 'drafts'
  name = 'draft'

  constructor(protected client: HTTPClient) {
    autoBind(this)
  }

  get proxy(): IRequestHandler<ResponseWrapper> {
    return this.client.proxy(this.base)
  }

  getShared(token: string) {
    return this.proxy.shared(token).get<SharedDraftModel>()
  }
}
