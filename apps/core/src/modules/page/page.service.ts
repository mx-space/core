import { isDefined } from 'class-validator'
import { omit } from 'lodash'
import slugify from 'slugify'

import { Injectable } from '@nestjs/common'

import { BizException } from '~/common/exceptions/biz.exception'
import { NoContentCanBeModifiedException } from '~/common/exceptions/no-content-canbe-modified.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { ImageService } from '~/processors/helper/helper.image.service'
import { TextMacroService } from '~/processors/helper/helper.macro.service'
import { InjectModel } from '~/transformers/model.transformer'
import { scheduleManager } from '~/utils'

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
    const count = await this.model.countDocuments({})
    if (count >= 10) {
      throw new BizException(ErrorCodeEnum.MaxCountLimit)
    }
    // `0` or `undefined` or `null`
    if (!doc.order) {
      doc.order = count + 1
    }
    const res = await this.model.create({
      ...doc,
      slug: slugify(doc.slug),
      created: new Date(),
    })

    this.imageService.saveImageDimensionsFromMarkdownText(
      doc.text,
      res.images,
      (images) => {
        res.images = images
        return res.save()
      },
    )

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
      .lean({ getters: true })

    if (!newDoc) {
      throw new NoContentCanBeModifiedException()
    }

    scheduleManager.schedule(async () => {
      await Promise.all([
        this.imageService.saveImageDimensionsFromMarkdownText(
          newDoc.text,
          newDoc.images,
          (images) => {
            return this.model
              .updateOne({ _id: id }, { $set: { images } })
              .exec()
          },
        ),
        this.eventManager.broadcast(BusinessEvents.PAGE_UPDATED, newDoc, {
          scope: EventScope.TO_SYSTEM,
        }),
        this.eventManager.broadcast(
          BusinessEvents.PAGE_UPDATED,
          {
            ...newDoc,
            text: await this.macroService.replaceTextMacro(newDoc.text, newDoc),
          },
          {
            scope: EventScope.TO_VISITOR,
          },
        ),
      ])
    })
  }
}
