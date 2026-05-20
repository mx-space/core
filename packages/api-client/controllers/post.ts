import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type { IRequestHandler, RequestProxyResult } from '~/interfaces/request'
import type { PaginateResult } from '~/models/base'
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
  year?: number
  sortBy?: 'categoryId' | 'title' | 'createdAt' | 'modifiedAt' | 'pinAt'
  sortOrder?: 1 | -1
  truncate?: number
  /** 语言代码，用于获取翻译版本 */
  lang?: string
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

  getList(page = 1, perPage = 10, options: PostListOptions = {}) {
    const { sortBy, sortOrder, year, truncate, lang } = options
    return this.proxy.get<PaginateResult<PostModel>>({
      params: {
        page,
        size: perPage,
        sortBy,
        sortOrder,
        year,
        truncate,
        lang,
      },
    })
  }

  getPost(
    categoryName: string,
    slug: string,
    options?: { lang?: string; prefer?: 'lexical' },
  ): RequestProxyResult<PostModel, ResponseWrapper>
  getPost(id: string): RequestProxyResult<PostModel, ResponseWrapper>
  getPost(
    idOrCategoryName: string,
    slug?: string,
    options?: { lang?: string; prefer?: 'lexical' },
  ): any {
    if (arguments.length == 1) {
      return this.proxy(idOrCategoryName).get<PostModel>()
    } else {
      const params: Record<string, string | undefined> = {}
      if (options?.lang) params.lang = options.lang
      if (options?.prefer) params.prefer = options.prefer
      return this.proxy(idOrCategoryName)(slug).get<PostModel>({
        params: Object.keys(params).length ? params : undefined,
      })
    }
  }

  getLatest() {
    return this.proxy.latest.get<PostModel>()
  }

  getFullUrl(slug: string) {
    return this.proxy('get-url')(slug).get<{ path: string }>()
  }
}
