import { forwardRef, Inject, Injectable } from '@nestjs/common'

import { getAvatar } from '~/utils/tool.util'

import { OwnerService } from '../owner/owner.service'
import { ReaderService } from '../reader/reader.service'

interface CommentLike {
  readerId?: string | null
  author?: string
  avatar?: string
  mail?: string
  replies?: CommentLike[]
}

@Injectable()
export class CommentReaderFillService {
  constructor(
    private readonly ownerService: OwnerService,
    @Inject(forwardRef(() => ReaderService))
    private readonly readerService: ReaderService,
  ) {}

  collectNestedReaderIds(comments: CommentLike[]): string[] {
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

  collectThreadReaderIds(comments: CommentLike[]): string[] {
    return this.collectNestedReaderIds(comments)
  }

  async fillAndReplaceAvatarUrl<T extends CommentLike>(
    comments: T[],
  ): Promise<T[]> {
    const owner = await this.ownerService.getOwner()
    const readerIds = new Set<string>()

    walkComments(comments, (comment) => {
      if (comment.readerId) {
        readerIds.add(comment.readerId)
      }
    })

    const readers = readerIds.size
      ? await this.readerService.findReaderInIds([...readerIds])
      : []
    const readerMap = new Map<string, any>()
    readers.forEach((reader: any) => {
      const id = reader.id || reader.id?.toString?.()
      if (id) {
        readerMap.set(id, reader)
      }
    })

    walkComments(comments, (comment) => {
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

function walkComments<T extends CommentLike>(
  comments: T[],
  visit: (comment: T) => void,
): void {
  for (const comment of comments) {
    if (typeof comment === 'string') continue
    visit(comment)

    const replies = comment.replies
    if (replies?.length) {
      walkComments(replies as T[], visit)
    }
  }
}
