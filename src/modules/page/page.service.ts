import { Injectable } from '@nestjs/common'
import { isDefined } from 'class-validator'
import { omit } from 'lodash'
import { InjectModel } from 'nestjs-typegoose'
import { EventTypes } from '~/processors/gateway/events.types'
import { WebEventsGateway } from '~/processors/gateway/web/events.gateway'
import { ImageService } from '~/processors/helper/helper.image.service'
import { PostModel } from '../post/post.model'
import { PageModel } from './page.model'

@Injectable()
export class PageService {
  constructor(
    @InjectModel(PageModel)
    private readonly pageModel: MongooseModel<PageModel>,
    private readonly imageService: ImageService,
    private readonly webgateService: WebEventsGateway,
  ) {}

  public get model() {
    return this.pageModel
  }

  public async create(doc: PageModel) {
    const res = await this.model.create({ ...doc, created: new Date() })
    process.nextTick(async () => {
      await Promise.all([
        this.imageService.recordImageDimensions(this.pageModel, res._id),
      ])
    })
    return res
  }

  public async updateById(id: string, doc: Partial<PageModel>) {
    if (['text', 'title', 'subtitle'].some((key) => isDefined(doc[key]))) {
      doc.modified = new Date()
    }
    await this.model.updateOne(
      { _id: id },
      { ...omit(doc, PostModel.protectedKeys) },
    )
    process.nextTick(async () => {
      await Promise.all([
        this.imageService.recordImageDimensions(this.pageModel, id),
        this.pageModel
          .findById(id)
          .then((doc) =>
            this.webgateService.broadcast(EventTypes.PAGE_UPDATED, doc),
          ),
      ])
    })
  }
}
