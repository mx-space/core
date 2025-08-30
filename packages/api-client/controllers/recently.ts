import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type { IRequestHandler } from '~/interfaces/request'
import type { RecentlyModel } from '~/models/recently'
import { autoBind } from '~/utils/auto-bind'
import type { HTTPClient } from '../core'

declare module '../core/client' {
  interface HTTPClient<
    T extends IRequestAdapter = IRequestAdapter,
    ResponseWrapper = unknown,
  > {
    recently: RecentlyController<ResponseWrapper>
    shorthand: RecentlyController<ResponseWrapper>
  }
}

export enum RecentlyAttitudeResultEnum {
  Inc = 1,
  Dec = -1,
}

export enum RecentlyAttitudeEnum {
  Up,
  Down,
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
    return this.proxy.latest.get<RecentlyModel & { comments: number }>()
  }

  getAll() {
    return this.proxy.all.get<{
      data: RecentlyModel[] & { comments: number }
    }>()
  }

  getList({
    before,
    after,
    size,
  }: {
    before?: string | undefined
    after?: string | undefined
    size?: number | number
  } = {}) {
    return this.proxy.get<{ data: RecentlyModel[] & { comments: number } }>({
      params: {
        before,
        after,
        size,
      },
    })
  }

  getById(id: string) {
    return this.proxy(id).get<RecentlyModel & { comments: number }>()
  }

  /**  表态：点赞，点踩 */
  attitude(id: string, attitude: RecentlyAttitudeEnum) {
    return this.proxy.attitude(id).get<{ code: RecentlyAttitudeResultEnum }>({
      params: {
        attitude,
      },
    })
  }
}
