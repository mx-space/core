import { Injectable } from '@nestjs/common'
import { InjectModel } from 'nestjs-typegoose'
import { EventTypes } from '~/processors/gateway/events.types'
import { WebEventsGateway } from '~/processors/gateway/web/events.gateway'
import { ImageService } from '~/processors/helper/helper.image.service'
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
    await this.model.updateOne({ _id: id, modified: new Date() }, doc)
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
