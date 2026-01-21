import { forwardRef, Inject, Injectable } from '@nestjs/common'
import { BizException } from '~/common/exceptions/biz.exception'
import { NoContentCanBeModifiedException } from '~/common/exceptions/no-content-canbe-modified.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { ImageService } from '~/processors/helper/helper.image.service'
import { TextMacroService } from '~/processors/helper/helper.macro.service'
import { InjectModel } from '~/transformers/model.transformer'
import { dbTransforms } from '~/utils/db-transform.util'
import { scheduleManager } from '~/utils/schedule.util'
import { isDefined } from '~/utils/validator.util'
import { omit } from 'es-toolkit/compat'
import slugify from 'slugify'
import { DraftService } from '../draft/draft.service'
import { PageModel } from './page.model'

@Injectable()
export class PageService {
  constructor(
    @InjectModel(PageModel)
    private readonly pageModel: MongooseModel<PageModel>,
    private readonly imageService: ImageService,
    private readonly eventManager: EventManagerService,
    private readonly macroService: TextMacroService,
    @Inject(forwardRef(() => DraftService))
    private readonly draftService: DraftService,
  ) {}

  public get model() {
    return this.pageModel
  }

  public async create(doc: PageModel & { draftId?: string }) {
    const { draftId } = doc
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
      meta: doc.meta
        ? (dbTransforms.json(doc.meta) as unknown as PageModel['meta'])
        : undefined,
    })

    // 处理草稿：标记为已发布，并关联到新创建的页面
    if (draftId) {
      await this.draftService.linkToPublished(draftId, res.id)
      await this.draftService.markAsPublished(draftId)
    }

    this.imageService.saveImageDimensionsFromMarkdownText(
      doc.text,
      res.images,
      async (images) => {
        res.images = images
        await res.save()
        this.eventManager.broadcast(BusinessEvents.PAGE_UPDATE, res, {
          scope: EventScope.TO_SYSTEM,
        })
      },
    )

    this.eventManager.broadcast(BusinessEvents.PAGE_CREATE, res, {
      scope: EventScope.TO_SYSTEM,
    })

    return res
  }

  public async updateById(
    id: string,
    doc: Partial<PageModel> & { draftId?: string },
  ) {
    const { draftId } = doc

    if (['text', 'title', 'subtitle'].some((key) => isDefined(doc[key]))) {
      doc.modified = new Date()
    }
    if (doc.slug) {
      doc.slug = slugify(doc.slug)
    }

    const newDoc = await this.model
      .findOneAndUpdate(
        { _id: id },
        {
          ...omit(doc, PageModel.protectedKeys),
          ...(doc.meta !== undefined
            ? { meta: dbTransforms.json(doc.meta) }
            : {}),
        },
        { new: true },
      )
      .lean({ getters: true })

    if (!newDoc) {
      throw new NoContentCanBeModifiedException()
    }

    // 处理草稿：标记为已发布
    if (draftId) {
      await this.draftService.markAsPublished(draftId)
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
        this.eventManager.broadcast(BusinessEvents.PAGE_UPDATE, newDoc, {
          scope: EventScope.TO_SYSTEM,
        }),
        this.eventManager.broadcast(
          BusinessEvents.PAGE_UPDATE,
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

  async deleteById(id: string) {
    await this.model.deleteOne({
      _id: id,
    })
    this.eventManager.broadcast(BusinessEvents.PAGE_DELETE, id, {
      scope: EventScope.ALL,
    })
  }
}
