import { IRequestAdapter } from '~/interfaces/adapter'
import { IController } from '~/interfaces/controller'
import { IRequestHandler } from '~/interfaces/request'
import { RecentlyModel } from '~/models/recently'
import { autoBind } from '~/utils/auto-bind'

import { HTTPClient } from '../core'

declare module '../core/client' {
  interface HTTPClient<
    T extends IRequestAdapter = IRequestAdapter,
    ResponseWrapper = unknown,
  > {
    recently: RecentlyController<ResponseWrapper>
    shorthand: RecentlyController<ResponseWrapper>
  }
}

export class RecentlyController<ResponseWrapper> implements IController {
  base = 'recently'
  name = ['recently', 'shorthand']

  constructor(private readonly client: HTTPClient) {
    autoBind(this)
  }

  get proxy(): IRequestHandler<ResponseWrapper> {
    return this.client.proxy(this.base)
  }
  /**
   * 获取最新一条
   */
  getLatestOne() {
    return this.proxy.latest.get<RecentlyModel>()
  }

  getAll() {
    return this.proxy.all.get<{ data: RecentlyModel[] }>()
  }

  getList(
    before?: string | undefined,
    after?: string | undefined,
    size?: number | number,
  ) {
    return this.proxy.get<{ data: RecentlyModel[] }>({
      params: {
        before,
        after,
        size,
      },
    })
  }
}
