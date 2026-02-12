import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type { IRequestHandler, RequestProxyResult } from '~/interfaces/request'
import type { SelectFields } from '~/interfaces/types'
import type { PaginateResult, TranslationMeta } from '~/models/base'
import type {
  NoteModel,
  NoteWrappedPayload,
  NoteWrappedWithLikedAndTranslationPayload,
  NoteWrappedWithLikedPayload,
} from '~/models/note'
import { autoBind } from '~/utils/auto-bind'
import type { HTTPClient } from '../core/client'
import type { SortOptions } from './base'

declare module '../core/client' {
  interface HTTPClient<
    T extends IRequestAdapter = IRequestAdapter,
    ResponseWrapper = unknown,
  > {
    note: NoteController<ResponseWrapper>
  }
}

export type NoteListOptions = {
  select?: SelectFields<keyof NoteModel>
  year?: number
  sortBy?: 'weather' | 'mood' | 'title' | 'created' | 'modified'
  sortOrder?: 1 | -1
}

export type NoteByNidOptions = {
  password?: string
  single?: boolean
  lang?: string
}

export type NoteMiddleListOptions = {
  lang?: string
}

export type NoteTopicListOptions = SortOptions & {
  lang?: string
}

export type NoteTimelineItem = Pick<
  NoteModel,
  'id' | 'title' | 'nid' | 'created' | 'isPublished'
> & {
  isTranslated?: boolean
  translationMeta?: TranslationMeta
}

export type NoteTopicListItem = NoteModel & {
  isTranslated?: boolean
  translationMeta?: TranslationMeta
}

export class NoteController<ResponseWrapper> implements IController {
  base = 'notes'
  name = 'note'

  constructor(private client: HTTPClient) {
    autoBind(this)
  }
  get proxy(): IRequestHandler<ResponseWrapper> {
    return this.client.proxy(this.base)
  }

  /**
   * 最新日记
   */
  getLatest() {
    return this.proxy.latest.get<NoteWrappedWithLikedPayload>()
  }

  /**
   * 获取一篇日记，根据 Id 查询需要鉴权
   * @param id id | nid
   * @param password 访问密码
   */

  getNoteById(
    id: string,
  ): Promise<RequestProxyResult<NoteModel, ResponseWrapper>>
  getNoteById(id: number): Promise<NoteWrappedPayload>
  getNoteById(id: number, password: string): Promise<NoteWrappedPayload>
  getNoteById(
    id: number,
    password: undefined,
    singleResult: true,
  ): Promise<RequestProxyResult<NoteModel, ResponseWrapper>>
  getNoteById(
    id: number,
    password: string,
    singleResult: true,
  ): Promise<RequestProxyResult<NoteModel, ResponseWrapper>>
  getNoteById(...rest: any[]): any {
    const [id, password = undefined, singleResult = false] = rest

    if (typeof id === 'number') {
      return this.proxy.nid(id.toString()).get<NoteWrappedWithLikedPayload>({
        params: { password, single: singleResult ? '1' : undefined },
      })
    } else {
      return this.proxy(id).get<NoteModel>()
    }
  }

  /**
   * 根据 nid 获取日记，支持翻译参数
   * @param nid 日记编号
   * @param options 可选参数：password, single, lang
   */
  getNoteByNid(
    nid: number,
    options?: NoteByNidOptions,
  ): RequestProxyResult<
    NoteWrappedWithLikedAndTranslationPayload,
    ResponseWrapper
  > {
    const { password, single, lang } = options || {}
    return this.proxy.nid(nid.toString()).get({
      params: {
        password,
        single: single ? '1' : undefined,
        lang,
      },
    })
  }

  /**
   * 日记列表分页
   */

  getList(page = 1, perPage = 10, options: NoteListOptions = {}) {
    const { select, sortBy, sortOrder, year } = options
    return this.proxy.get<PaginateResult<NoteModel>>({
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
   * 获取当前日记的上下各 n / 2 篇日记
   * @param id 当前日记 ID
   * @param size 返回数量，默认 5
   * @param options 可选参数，包含 lang 用于获取翻译版本
   */
  getMiddleList(id: string, size = 5, options?: NoteMiddleListOptions) {
    const { lang } = options || {}
    return this.proxy.list(id).get<{
      data: NoteTimelineItem[]
      size: number
    }>({
      params: { size, lang },
    })
  }

  /**
   * 获取专栏内的所有日记
   * @param topicId 专栏 ID
   * @param page 页码，默认 1
   * @param size 每页数量，默认 10
   * @param options 可选参数，包含排序选项和 lang 用于获取翻译版本
   */
  getNoteByTopicId(
    topicId: string,
    page = 1,
    size = 10,
    options: NoteTopicListOptions = {},
  ) {
    const { lang, ...sortOptions } = options
    return this.proxy.topics(topicId).get<PaginateResult<NoteTopicListItem>>({
      params: { page, size, lang, ...sortOptions },
    })
  }
}
