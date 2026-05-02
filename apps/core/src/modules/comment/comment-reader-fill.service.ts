import { forwardRef, Inject, Injectable } from '@nestjs/common'

import { getAvatar } from '~/utils/tool.util'

import { OwnerService } from '../owner/owner.service'
import { ReaderModel } from '../reader/reader.model'
import { ReaderService } from '../reader/reader.service'
import { CommentModel } from './comment.model'

type CommentWithReplies = CommentModel & { replies?: CommentModel[] }

@Injectable()
export class CommentReaderFillService {
  constructor(
    private readonly ownerService: OwnerService,
    @Inject(forwardRef(() => ReaderService))
    private readonly readerService: ReaderService,
  ) {}

  collectNestedReaderIds(comments: CommentWithReplies[]): string[] {
    const readerIds = new Set<string>()

    for (const comment of comments) {
      if (comment.readerId) {
        readerIds.add(comment.readerId)
      }

      for (const reply of comment.replies || []) {
        if (reply.readerId) {
          readerIds.add(reply.readerId)
        }
      }
    }

    return [...readerIds]
  }

  collectThreadReaderIds(comments: CommentWithReplies[]): string[] {
    return this.collectNestedReaderIds(comments)
  }

  async fillAndReplaceAvatarUrl(
    comments: CommentModel[],
  ): Promise<CommentModel[]> {
    const owner = await this.ownerService.getOwner()
    const readerIds = new Set<string>()

    walkComments(comments as CommentWithReplies[], (comment) => {
      if (comment.readerId) {
        readerIds.add(comment.readerId)
      }
    })

    const readers = readerIds.size
      ? await this.readerService.findReaderInIds([...readerIds])
      : []
    const readerMap = new Map<string, ReaderModel>()
    readers.forEach((reader) => {
      const id = (reader as any).id || (reader as any)._id?.toString?.()
      if (id) {
        readerMap.set(id, reader)
      }
    })

    walkComments(comments as CommentWithReplies[], (comment) => {
      const reader = comment.readerId ? readerMap.get(comment.readerId) : null
      if (reader) {
        const isOwner = reader.role === 'owner'
        comment.author =
          isOwner && owner.name ? owner.name : reader.name || comment.author
        comment.avatar =
          (isOwner ? owner.avatar : undefined) ||
          reader.image ||
          getAvatar(reader.email)
      }
      if (comment.author === owner.name) {
        comment.avatar = owner.avatar || comment.avatar
      }

      if (!comment.avatar) {
        comment.avatar = getAvatar(comment.mail)
      }
    })

    return comments
  }
}

function walkComments(
  comments: CommentWithReplies[],
  visit: (comment: CommentWithReplies) => void,
): void {
  for (const comment of comments) {
    if (typeof comment === 'string') continue
    visit(comment)

    const replies = comment.replies
    if (replies?.length) {
      walkComments(replies as CommentWithReplies[], visit)
    }
  }
}
