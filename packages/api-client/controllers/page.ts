import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type { IRequestHandler } from '~/interfaces/request'
import type { PaginateResult } from '~/models/base'
import type { PageModel } from '~/models/page'
import { autoBind } from '~/utils/auto-bind'

import type { HTTPClient } from '../core'

declare module '@mx-space/api-client' {
  interface HTTPClient<
    T extends IRequestAdapter = IRequestAdapter,
    ResponseWrapper = unknown,
  > {
    page: PageController<ResponseWrapper>
  }
}

export type PageListOptions = {
  sortBy?: 'order' | 'subtitle' | 'title' | 'createdAt' | 'modifiedAt'
  sortOrder?: 1 | -1
}

export class PageController<ResponseWrapper> implements IController {
  constructor(private readonly client: HTTPClient) {
    autoBind(this)
  }
  base = 'pages'
  name = 'page'
  get proxy(): IRequestHandler<ResponseWrapper> {
    return this.client.proxy(this.base)
  }
  /**
   * 页面列表
   */
  getList(page = 1, perPage = 10, options: PageListOptions = {}) {
    const { sortBy, sortOrder } = options
    return this.proxy.get<PaginateResult<PageModel>>({
      params: {
        page,
        size: perPage,
        sortBy,
        sortOrder,
      },
    })
  }

  /**
   * 页面详情
   */
  getById(id: string) {
    return this.proxy(id).get<PageModel>()
  }
  /**
   * 根据路径获取页面
   * @param slug 路径
   * @returns
   */
  getBySlug(slug: string, options?: { prefer?: 'lexical' }) {
    return this.proxy.slug(slug).get<PageModel>({
      params: options?.prefer ? { prefer: options.prefer } : undefined,
    })
  }
}
