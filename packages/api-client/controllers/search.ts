import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type { IRequestHandler, RequestProxyResult } from '~/interfaces/request'
import type { PaginateResult } from '~/models/base'
import type { NoteModel } from '~/models/note'
import type { PageModel } from '~/models/page'
import type { PostModel } from '~/models/post'
import { autoBind } from '~/utils/auto-bind'

import type { HTTPClient } from '../core'

declare module '@mx-space/api-client' {
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
  /** Override the request-context lang for this query. Server falls back to
   * the request `x-lang` header / `?lang=` if not set. */
  lang?: string
}

export type SearchHighlight = {
  keywords: string[]
  snippet: string | null
}

export type SearchResultMeta = {
  /** The lang of the index row that produced this hit. */
  lang: string
  /** True when the hit came from the source-language fallback rather than the
   * effective lang index. UI can flag these as "matched in original". */
  isFallback: boolean
}

type SearchResultHighlight = {
  highlight: SearchHighlight
} & SearchResultMeta

export type SearchRebuildStats = {
  total: number
  created: number
  updated: number
  deleted: number
  skipped: number
}

export type SearchAdminListQuery = {
  refType?: SearchType
  lang?: string
  keyword?: string
  page?: number
  size?: number
}

export type SearchAdminDocument = {
  id: string
  refType: SearchType
  refId: string
  lang: string
  sourceHash: string
  title: string
  titleLength: number
  bodyLength: number
  isPublished: boolean
  publicAt: string | null
  hasPassword: boolean
  modifiedAt: string | null
  createdAt: string
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

  /** Trigger a global rebuild. Defaults to incremental (sourceHash diff);
   * pass `force: true` for the legacy delete-all + bulk-upsert path. */
  rebuild(opts: { force?: boolean } = {}) {
    return this.proxy.rebuild.post<
      RequestProxyResult<SearchRebuildStats, ResponseWrapper>
    >({
      params: opts.force ? { force: true } : undefined,
    })
  }

  /** Force-refresh a single article and all of its translations. */
  rebuildOne(refType: SearchType, refId: string) {
    return this.proxy
      .rebuild(refType)(refId)
      .post<RequestProxyResult<{ rebuilt: number }, ResponseWrapper>>()
  }

  /** Admin-facing paginated listing of indexed documents (verification UI). */
  adminListDocuments(query: SearchAdminListQuery = {}) {
    return this.proxy.admin.documents.get<
      RequestProxyResult<PaginateResult<SearchAdminDocument>, ResponseWrapper>
    >({ params: query as Record<string, any> })
  }
}
