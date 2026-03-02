import { Injectable } from '@nestjs/common'

import { BusinessEvents } from '~/constants/business-event.constant'
import { NoteModel } from '~/modules/note/note.model'
import { PageModel } from '~/modules/page/page.model'
import { PostModel } from '~/modules/post/post.model'
import { InjectModel } from '~/transformers/model.transformer'

@Injectable()
export class EventPayloadEnricherService {
  constructor(
    @InjectModel(PostModel)
    private readonly postModel: MongooseModel<PostModel>,
    @InjectModel(NoteModel)
    private readonly noteModel: MongooseModel<NoteModel>,
    @InjectModel(PageModel)
    private readonly pageModel: MongooseModel<PageModel>,
  ) {}

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
      default: {
        return data
      }
    }
  }
}
