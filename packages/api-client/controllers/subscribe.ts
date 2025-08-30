import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type { IRequestHandler } from '~/interfaces/request'
import type { SubscribeType } from '~/models/subscribe'
import { autoBind } from '~/utils/auto-bind'
import type { HTTPClient } from '../core'

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
      allowBits: number[]
      allowTypes: SubscribeType[]
    }>()
  }

  subscribe(email: string, types: SubscribeType[]) {
    return this.proxy.post<never>({
      data: {
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
