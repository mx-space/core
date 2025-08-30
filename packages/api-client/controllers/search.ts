import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type { IRequestHandler, RequestProxyResult } from '~/interfaces/request'
import type { PaginateResult } from '~/models/base'
import type { NoteModel } from '~/models/note'
import type { PostModel } from '~/models/post'
import { autoBind } from '~/utils/auto-bind'
import type { PageModel } from '..'
import type { HTTPClient } from '../core'

declare module '../core/client' {
  interface HTTPClient<
    T extends IRequestAdapter = IRequestAdapter,
    ResponseWrapper = unknown,
  > {
    search: SearchController<ResponseWrapper>
  }
}

export type SearchType = 'post' | 'note'

export type SearchOption = {
  orderBy?: string
  order?: number
  rawAlgolia?: boolean
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
    options?: Omit<SearchOption, 'rawAlgolia'>,
  ): Promise<
    RequestProxyResult<
      PaginateResult<
        Pick<NoteModel, 'modified' | 'id' | 'title' | 'created' | 'nid'>
      >,
      ResponseWrapper
    >
  >
  search(
    type: 'post',
    keyword: string,
    options?: Omit<SearchOption, 'rawAlgolia'>,
  ): Promise<
    RequestProxyResult<
      PaginateResult<
        Pick<
          PostModel,
          'modified' | 'id' | 'title' | 'created' | 'slug' | 'category'
        >
      >,
      ResponseWrapper
    >
  >
  search(
    type: SearchType,
    keyword: string,
    options: Omit<SearchOption, 'rawAlgolia'> = {},
  ): any {
    return this.proxy(type).get({
      params: { keyword, ...options },
    })
  }
  /**
   * 从 algolya 搜索
   * https://www.algolia.com/doc/api-reference/api-methods/search/
   * @param keyword
   * @param options
   * @returns
   */
  searchByAlgolia(keyword: string, options?: SearchOption) {
    return this.proxy('algolia').get<
      RequestProxyResult<
        PaginateResult<
          | (Pick<
              PostModel,
              'modified' | 'id' | 'title' | 'created' | 'slug' | 'category'
            > & { type: 'post' })
          | (Pick<
              NoteModel,
              'id' | 'created' | 'id' | 'modified' | 'title' | 'nid'
            > & { type: 'note' })
          | (Pick<
              PageModel,
              'id' | 'title' | 'created' | 'modified' | 'slug'
            > & { type: 'page' })
        > & {
          /**
           * @see: algoliasearch <https://www.algolia.com/doc/api-reference/api-methods/search/>
           */
          raw?: any
        },
        ResponseWrapper
      >
    >({ params: { keyword, ...options } })
  }
}
