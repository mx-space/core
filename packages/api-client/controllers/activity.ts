import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type { IRequestHandler } from '~/interfaces/request'

import { autoBind } from '~/utils/auto-bind'

import { HTTPClient } from '../core'

declare module '../core/client' {
  interface HTTPClient<
    T extends IRequestAdapter = IRequestAdapter,
    ResponseWrapper = unknown,
  > {
    activity: ActivityController<ResponseWrapper>
  }
}

/**
 * @support core >= 4.3.0
 */
export class ActivityController<ResponseWrapper> implements IController {
  base = 'activity'
  name = 'activity'

  constructor(private client: HTTPClient) {
    autoBind(this)
  }

  public get proxy(): IRequestHandler<ResponseWrapper> {
    return this.client.proxy(this.base)
  }

  likeIt(type: 'Post' | 'Note', id: string) {
    return this.proxy.like.post<never>({
      type,
      id,
    })
  }
}
