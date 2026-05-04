import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type { IRequestHandler, RequestProxyResult } from '~/interfaces/request'
import type { PaginateResult } from '~/models/base'
import type { NoteModel } from '~/models/note'
import type { PageModel } from '~/models/page'
import type { PostModel } from '~/models/post'
import { autoBind } from '~/utils/auto-bind'

import type { HTTPClient } from '../core'

declare module '../core/client' {
  interface HTTPClient<
    T extends IRequestAdapter = IRequestAdapter,
    ResponseWrapper = unknown,
  > {
    search: SearchController<ResponseWrapper>
  }
}

export type SearchType = 'post' | 'note' | 'page'

export type SearchOption = {
  orderBy?: string
  order?: number
}

export type SearchHighlight = {
  keywords: string[]
  snippet: string | null
}

type SearchResultHighlight = {
  highlight: SearchHighlight
}

export class SearchController<ResponseWrapper> implements IController {
  base = 'search'
  name = 'search'

  constructor(private readonly client: HTTPClient) {
    autoBind(this)
  }

  get proxy(): IRequestHandler<ResponseWrapper> {
    return this.client.proxy(this.base)
  }

  search(
    type: 'note',
    keyword: string,
    options?: SearchOption,
  ): Promise<
    RequestProxyResult<
      PaginateResult<
        Pick<NoteModel, 'modifiedAt' | 'id' | 'title' | 'createdAt' | 'nid'> &
          SearchResultHighlight
      >,
      ResponseWrapper
    >
  >
  search(
    type: 'post',
    keyword: string,
    options?: SearchOption,
  ): Promise<
    RequestProxyResult<
      PaginateResult<
        Pick<
          PostModel,
          'modifiedAt' | 'id' | 'title' | 'createdAt' | 'slug' | 'category'
        > &
          SearchResultHighlight
      >,
      ResponseWrapper
    >
  >
  search(
    type: 'page',
    keyword: string,
    options?: SearchOption,
  ): Promise<
    RequestProxyResult<
      PaginateResult<
        Pick<PageModel, 'modifiedAt' | 'id' | 'title' | 'createdAt' | 'slug'> &
          SearchResultHighlight
      >,
      ResponseWrapper
    >
  >
  search(type: SearchType, keyword: string, options: SearchOption = {}): any {
    return this.proxy(type).get({
      params: { keyword, ...options },
    })
  }

  searchAll(keyword: string, options?: SearchOption) {
    return this.proxy.get<
      RequestProxyResult<
        PaginateResult<
          | (Pick<
              PostModel,
              'modifiedAt' | 'id' | 'title' | 'createdAt' | 'slug' | 'category'
            > &
              SearchResultHighlight & { type: 'post' })
          | (Pick<
              NoteModel,
              'id' | 'createdAt' | 'modifiedAt' | 'title' | 'nid'
            > &
              SearchResultHighlight & { type: 'note' })
          | (Pick<
              PageModel,
              'id' | 'title' | 'createdAt' | 'modifiedAt' | 'slug'
            > &
              SearchResultHighlight & { type: 'page' })
        >,
        ResponseWrapper
      >
    >({ params: { keyword, ...options } })
  }
}
