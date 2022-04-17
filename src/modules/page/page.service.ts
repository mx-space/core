import { isDefined } from 'class-validator'
import { omit } from 'lodash'
import slugify from 'slugify'

import { Injectable } from '@nestjs/common'

import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { ImageService } from '~/processors/helper/helper.image.service'
import { InjectModel } from '~/transformers/model.transformer'

import { PageModel } from './page.model'

@Injectable()
export class PageService {
  constructor(
    @InjectModel(PageModel)
    private readonly pageModel: MongooseModel<PageModel>,
    private readonly imageService: ImageService,
    private readonly eventManager: EventManagerService,
  ) {}

  public get model() {
    return this.pageModel
  }

  public async create(doc: PageModel) {
    const res = await this.model.create({
      ...doc,
      slug: slugify(doc.slug),
      created: new Date(),
    })
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
    if (doc.slug) {
      doc.slug = slugify(doc.slug)
    }

    await this.model.updateOne(
      { _id: id },
      { ...omit(doc, PageModel.protectedKeys) },
    )
    process.nextTick(async () => {
      await Promise.all([
        this.imageService.recordImageDimensions(this.pageModel, id),
        this.pageModel.findById(id).then((doc) =>
          this.eventManager.broadcast(BusinessEvents.PAGE_UPDATED, doc, {
            scope: EventScope.TO_SYSTEM_VISITOR,
          }),
        ),
      ])
    })
  }
}
