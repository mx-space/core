import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type { IRequestHandler } from '~/interfaces/request'
import type { SelectFields } from '~/interfaces/types'
import type { PaginateResult } from '~/models/base'
import type { PageModel } from '~/models/page'
import { autoBind } from '~/utils/auto-bind'
import type { HTTPClient } from '../core'

declare module '../core/client' {
  interface HTTPClient<
    T extends IRequestAdapter = IRequestAdapter,
    ResponseWrapper = unknown,
  > {
    page: PageController<ResponseWrapper>
  }
}

export type PageListOptions = {
  select?: SelectFields<keyof PageModel>
  sortBy?: 'order' | 'subtitle' | 'title' | 'created' | 'modified'
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
    const { select, sortBy, sortOrder } = options
    return this.proxy.get<PaginateResult<PageModel>>({
      params: {
        page,
        size: perPage,
        select: select?.join(' '),
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
  getBySlug(slug: string) {
    return this.proxy.slug(slug).get<PageModel>({})
  }
}
