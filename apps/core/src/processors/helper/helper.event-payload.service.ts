import { Injectable } from '@nestjs/common'

import { BusinessEvents } from '~/constants/business-event.constant'
import { NoteModel } from '~/modules/note/note.model'
import { OwnerService } from '~/modules/owner/owner.service'
import { PageModel } from '~/modules/page/page.model'
import { PostModel } from '~/modules/post/post.model'
import { ReaderService } from '~/modules/reader/reader.service'
import { InjectModel } from '~/transformers/model.transformer'
import { getAvatar } from '~/utils/tool.util'

@Injectable()
export class EventPayloadEnricherService {
  constructor(
    @InjectModel(PostModel)
    private readonly postModel: MongooseModel<PostModel>,
    @InjectModel(NoteModel)
    private readonly noteModel: MongooseModel<NoteModel>,
    @InjectModel(PageModel)
    private readonly pageModel: MongooseModel<PageModel>,
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
        avatar: owner?.avatar || reader.image || getAvatar(reader.email),
      }
    }

    return {
      ...data,
      author: reader.name || data.author,
      avatar: reader.image || data.avatar || getAvatar(reader.email),
    }
  }

  async enrichPayload(event: BusinessEvents, data: any): Promise<any> {
    if (!data?.id) return data

    switch (event) {
      case BusinessEvents.POST_CREATE: {
        return (
          (await this.postModel
            .findById(data.id)
            .populate('category')
            .lean({ getters: true })) ?? data
        )
      }
      case BusinessEvents.POST_UPDATE: {
        return (
          (await this.postModel
            .findById(data.id)
            .populate('category')
            .populate({
              path: 'related',
              select: 'title slug id _id categoryId category',
            })
            .lean({ getters: true })) ?? data
        )
      }
      case BusinessEvents.NOTE_CREATE:
      case BusinessEvents.NOTE_UPDATE: {
        return (
          (await this.noteModel.findById(data.id).lean({ getters: true })) ??
          data
        )
      }
      case BusinessEvents.PAGE_CREATE:
      case BusinessEvents.PAGE_UPDATE: {
        return (
          (await this.pageModel.findById(data.id).lean({ getters: true })) ??
          data
        )
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
