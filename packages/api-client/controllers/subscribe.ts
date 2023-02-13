import { IRequestAdapter } from '~/interfaces/adapter'
import { IController } from '~/interfaces/controller'
import { IRequestHandler } from '~/interfaces/request'
import { SubscribeType } from '~/models/subscribe'
import { autoBind } from '~/utils/auto-bind'

import { HTTPClient } from '../core'

declare module '../core/client' {
  interface HTTPClient<
    T extends IRequestAdapter = IRequestAdapter,
    ResponseWrapper = unknown,
  > {
    subscribe: SubscribeController<ResponseWrapper>
  }
}

export class SubscribeController<ResponseWrapper> implements IController {
  base = 'subscribe'
  name = 'subscribe'

  constructor(protected client: HTTPClient) {
    autoBind(this)
  }

  public get proxy(): IRequestHandler<ResponseWrapper> {
    return this.client.proxy(this.base)
  }

  /**
   * 检查开启状态
   */
  check() {
    return this.proxy.status.get<{
      enable: boolean
      bitMap: Record<SubscribeType, number>
      allowTypes: number[]
    }>()
  }

  subscribe(email: string, types: SubscribeType[]) {
    return this.proxy.post<never>({
      params: {
        email,
        types,
      },
    })
  }

  unsubscribe(email: string, cancelToken: string) {
    return this.proxy.unsubscribe.get<string>({
      params: {
        email,
        cancelToken,
      },
    })
  }
}
