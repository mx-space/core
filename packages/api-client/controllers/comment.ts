import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type { PaginationParams } from '~/interfaces/params'
import type { IRequestHandler } from '~/interfaces/request'
import type { ReaderModel } from '~/models'
import type { PaginateResult } from '~/models/base'
import type { CommentModel } from '~/models/comment'
import { autoBind } from '~/utils/auto-bind'
import type { HTTPClient } from '../core'
import type { CommentDto } from '../dtos/comment'

declare module '../core/client' {
  interface HTTPClient<
    T extends IRequestAdapter = IRequestAdapter,
    ResponseWrapper = unknown,
  > {
    comment: CommentController<ResponseWrapper>
  }
}

export class CommentController<ResponseWrapper> implements IController {
  base = 'comments'
  name = 'comment'

  constructor(private readonly client: HTTPClient) {
    autoBind(this)
  }

  get proxy(): IRequestHandler<ResponseWrapper> {
    return this.client.proxy(this.base)
  }

  /**
   * 根据 comment id 获取评论，包括子评论
   */
  getById(id: string) {
    return this.proxy(id).get<CommentModel & { ref: string }>()
  }

  /**
   * 获取文章的评论列表
   * @param refId 文章 Id
   */
  getByRefId(refId: string, pagination: PaginationParams = {}) {
    const { page, size } = pagination
    return this.proxy.ref(refId).get<
      PaginateResult<CommentModel & { ref: string }> & {
        readers: Record<string, ReaderModel>
      }
    >({
      params: { page: page || 1, size: size || 10 },
    })
  }
  /**
   * 评论
   */
  comment(refId: string, data: CommentDto) {
    return this.proxy(refId).post<CommentModel>({
      data,
    })
  }

  /**
   * 回复评论
   */
  reply(commentId: string, data: CommentDto) {
    return this.proxy.reply(commentId).post<CommentModel>({
      data,
    })
  }
}
