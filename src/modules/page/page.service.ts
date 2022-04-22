import { isDefined } from 'class-validator'
import { omit } from 'lodash'
import slugify from 'slugify'

import { Injectable } from '@nestjs/common'

import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { ImageService } from '~/processors/helper/helper.image.service'
import { TextMacroService } from '~/processors/helper/helper.macro.service'
import { InjectModel } from '~/transformers/model.transformer'

import { PageModel } from './page.model'

@Injectable()
export class PageService {
  constructor(
    @InjectModel(PageModel)
    private readonly pageModel: MongooseModel<PageModel>,
    private readonly imageService: ImageService,
    private readonly eventManager: EventManagerService,
    private readonly macroService: TextMacroService,
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

    const newDoc = await this.model
      .findOneAndUpdate(
        { _id: id },
        { ...omit(doc, PageModel.protectedKeys) },
        { new: true },
      )
      .lean()

    if (!newDoc) {
      throw new CannotFindException()
    }

    process.nextTick(async () => {
      await Promise.all([
        this.imageService.recordImageDimensions(this.pageModel, id),
        this.eventManager.broadcast(BusinessEvents.PAGE_UPDATED, newDoc, {
          scope: EventScope.TO_SYSTEM,
        }),
        this.eventManager.broadcast(
          BusinessEvents.PAGE_UPDATED,
          {
            ...newDoc,
            text: this.macroService.replaceTextMacro(newDoc.text, newDoc),
          },
          {
            scope: EventScope.TO_VISITOR,
          },
        ),
      ])
    })
  }
}
