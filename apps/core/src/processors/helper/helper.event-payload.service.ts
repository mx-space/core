import { Injectable } from '@nestjs/common'

import { BusinessEvents } from '~/constants/business-event.constant'
import { NoteService } from '~/modules/note/note.service'
import { OwnerService } from '~/modules/owner/owner.service'
import { PageService } from '~/modules/page/page.service'
import { PostService } from '~/modules/post/post.service'
import { ReaderService } from '~/modules/reader/reader.service'
import { getAvatar } from '~/utils/tool.util'

@Injectable()
export class EventPayloadEnricherService {
  constructor(
    private readonly postService: PostService,
    private readonly noteService: NoteService,
    private readonly pageService: PageService,
    private readonly readerService: ReaderService,
    private readonly ownerService: OwnerService,
  ) {}

  private async enrichCommentPayload(data: any): Promise<any> {
    if (!data?.readerId) {
      return data
    }

    const reader = await this.readerService
      .findReaderInIds([data.readerId])
      .then((readers) => readers[0] ?? null)

    if (!reader) {
      return data
    }

    if (reader.role === 'owner') {
      const owner = await this.ownerService.getOwner().catch(() => null)

      return {
        ...data,
        author: owner?.name || reader.name || data.author,
        avatar:
          owner?.avatar || reader.image || getAvatar(reader.email ?? undefined),
      }
    }

    return {
      ...data,
      author: reader.name || data.author,
      avatar:
        reader.image || data.avatar || getAvatar(reader.email ?? undefined),
    }
  }

  async enrichPayload(event: BusinessEvents, data: any): Promise<any> {
    if (!data?.id) return data

    switch (event) {
      case BusinessEvents.POST_CREATE: {
        return (await this.postService.findById(data.id)) ?? data
      }
      case BusinessEvents.POST_UPDATE: {
        return (await this.postService.findById(data.id)) ?? data
      }
      case BusinessEvents.NOTE_CREATE:
      case BusinessEvents.NOTE_UPDATE: {
        return (await this.noteService.findById(data.id)) ?? data
      }
      case BusinessEvents.PAGE_CREATE:
      case BusinessEvents.PAGE_UPDATE: {
        return (await this.pageService.findById(data.id)) ?? data
      }
      case BusinessEvents.COMMENT_CREATE: {
        return this.enrichCommentPayload(data)
      }
      default: {
        return data
      }
    }
  }
}
