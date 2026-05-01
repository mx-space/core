import type { IRequestAdapter } from '~/interfaces/adapter'
import type { IController } from '~/interfaces/controller'
import type { PaginationParams } from '~/interfaces/params'
import type { IRequestHandler } from '~/interfaces/request'
import type { ReaderModel } from '~/models'
import type { PaginateResult } from '~/models/base'
import type {
  CommentModel,
  CommentThreadItem,
  CommentThreadReplies,
} from '~/models/comment'
import { autoBind } from '~/utils/auto-bind'

import type { HTTPClient } from '../core'
import type {
  AnonymousCommentDto,
  CommentUploadConfigDto,
  CommentUploadResultDto,
  ReaderCommentDto,
} from '../dtos/comment'

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
  getByRefId(
    refId: string,
    params: PaginationParams & {
      sort?: 'pinned' | 'newest' | 'oldest'
      around?: string
    } = {},
  ) {
    const { page, size, sort, around } = params
    return this.proxy.ref(refId).get<
      PaginateResult<CommentThreadItem & { ref: string }> & {
        readers: Record<string, ReaderModel>
      }
    >({
      params: {
        page: page || 1,
        size: size || 10,
        ...(sort ? { sort } : {}),
        ...(around ? { around } : {}),
      },
    })
  }

  getThreadReplies(
    rootCommentId: string,
    params: PaginationParams & { cursor?: string } = {},
  ) {
    return this.proxy.thread(rootCommentId).get<CommentThreadReplies>({
      params,
    })
  }
  /**
   * 评论
   */
  guestComment(refId: string, data: AnonymousCommentDto) {
    return this.proxy.guest(refId).post<CommentModel>({
      data,
    })
  }

  /**
   * 回复评论
   */
  guestReply(commentId: string, data: AnonymousCommentDto) {
    return this.proxy.guest.reply(commentId).post<CommentModel>({
      data,
    })
  }

  readerComment(refId: string, data: ReaderCommentDto) {
    return this.proxy.reader(refId).post<CommentModel>({
      data,
    })
  }

  readerReply(commentId: string, data: ReaderCommentDto) {
    return this.proxy.reader.reply(commentId).post<CommentModel>({
      data,
    })
  }

  /**
   * 取评论图片上传之公开配置（启用状态、限额、MIME 白名单等）
   */
  getUploadConfig() {
    return this.proxy.uploads.config.get<CommentUploadConfigDto>()
  }

  /**
   * 已登录读者上传评论图片
   * @param file - 浏览器 File / Blob 或 node 之 Buffer 包装
   */
  uploadImage(file: File | Blob) {
    const form = new FormData()
    form.append('file', file)
    return this.proxy.uploads.post<CommentUploadResultDto>({
      data: form,
    })
  }
}
