import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type { IRequestHandler, RequestProxyResult } from '~/interfaces/request'
import type { SelectFields } from '~/interfaces/types'
import type { ModelWithLiked, PaginateResult } from '~/models/base'
import type { PostModel } from '~/models/post'
import { autoBind } from '~/utils/auto-bind'
import type { HTTPClient } from '../core/client'

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
  truncate?: number
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
    const { select, sortBy, sortOrder, year, truncate } = options
    return this.proxy.get<PaginateResult<PostModel>>({
      params: {
        page,
        size: perPage,
        select: select?.join(' '),
        sortBy,
        sortOrder,
        year,
        truncate,
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
  ): RequestProxyResult<ModelWithLiked<PostModel>, ResponseWrapper>
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
    return this.proxy.latest.get<ModelWithLiked<PostModel>>()
  }

  getFullUrl(slug: string) {
    return this.proxy('get-url')(slug).get<{ path: string }>()
  }
}
