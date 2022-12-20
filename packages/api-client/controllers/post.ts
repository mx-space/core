import { IRequestAdapter } from '~/interfaces/adapter'
import { IController } from '~/interfaces/controller'
import { IRequestHandler, RequestProxyResult } from '~/interfaces/request'
import { SelectFields } from '~/interfaces/types'
import { PaginateResult } from '~/models/base'
import { PostModel } from '~/models/post'
import { autoBind } from '~/utils/auto-bind'

import { HTTPClient } from '../core/client'

declare module '../core/client' {
  interface HTTPClient<
    T extends IRequestAdapter = IRequestAdapter,
    ResponseWrapper = unknown,
  > {
    post: PostController<ResponseWrapper>
  }
}

export type PostListOptions = {
  select?: SelectFields<keyof PostModel>
  year?: number
  sortBy?: 'categoryId' | 'title' | 'created' | 'modified'
  sortOrder?: 1 | -1
}

export class PostController<ResponseWrapper> implements IController {
  constructor(private client: HTTPClient) {
    autoBind(this)
  }

  base = 'posts'

  name = 'post'

  public get proxy(): IRequestHandler<ResponseWrapper> {
    return this.client.proxy(this.base)
  }

  /**
   * 获取文章列表分页
   * @param page
   * @param perPage
   * @returns
   */
  getList(page = 1, perPage = 10, options: PostListOptions = {}) {
    const { select, sortBy, sortOrder, year } = options
    return this.proxy.get<PaginateResult<PostModel>>({
      params: {
        page,
        size: perPage,
        select: select?.join(' '),
        sortBy,
        sortOrder,
        year,
      },
    })
  }

  /**
   * 根据分类和路径查找文章
   * @param categoryName
   * @param slug
   */
  getPost(
    categoryName: string,
    slug: string,
  ): RequestProxyResult<PostModel, ResponseWrapper>
  /**
   * 根据 ID 查找文章
   * @param id
   */
  getPost(id: string): RequestProxyResult<PostModel, ResponseWrapper>
  getPost(idOrCategoryName: string, slug?: string): any {
    if (arguments.length == 1) {
      return this.proxy(idOrCategoryName).get<PostModel>()
    } else {
      return this.proxy(idOrCategoryName)(slug).get<PostModel>()
    }
  }

  /**
   * 获取最新的文章
   */
  getLatest() {
    return this.proxy.latest.get<PostModel>()
  }

  /**
   * 点赞
   */
  thumbsUp(id: string) {
    return this.proxy('_thumbs-up').get<void>({ params: { id } })
  }
}
