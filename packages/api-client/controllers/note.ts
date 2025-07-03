import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type { IRequestHandler, RequestProxyResult } from '~/interfaces/request'
import type { SelectFields } from '~/interfaces/types'
import type { PaginateResult } from '~/models/base'
import type {
  NoteModel,
  NoteWrappedPayload,
  NoteWrappedWithLikedPayload,
} from '~/models/note'
import type { HTTPClient } from '../core/client'
import type { SortOptions } from './base'

import { autoBind } from '~/utils/auto-bind'

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
   */
  getMiddleList(id: string, size = 5) {
    return this.proxy.list(id).get<{
      data: Pick<
        NoteModel,
        'id' | 'title' | 'nid' | 'created' | 'isPublished'
      >[]
      size: number
    }>({
      params: { size },
    })
  }

  /**
   * 获取专栏内的所有日记
   */
  getNoteByTopicId(
    topicId: string,
    page = 1,
    size = 10,
    sortOptions: SortOptions = {},
  ) {
    return this.proxy.topics(topicId).get<PaginateResult<NoteModel>>({
      params: { page, size, ...sortOptions },
    })
  }
}
