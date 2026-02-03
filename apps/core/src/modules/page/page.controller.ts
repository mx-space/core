import {
  Body,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators, Paginator } from '~/common/decorators/http.decorator'
import { Lang } from '~/common/decorators/lang.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { TextMacroService } from '~/processors/helper/helper.macro.service'
import {
  TranslationEnhancerService,
  type ArticleTranslationInput,
} from '~/processors/helper/helper.translation-enhancer.service'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'
import { PageModel } from './page.model'
import { PageDto, PageReorderDto, PartialPageDto } from './page.schema'
import { PageService } from './page.service'

@ApiController('pages')
export class PageController {
  constructor(
    private readonly pageService: PageService,
    private readonly macroService: TextMacroService,
    private readonly translationEnhancerService: TranslationEnhancerService,
  ) {}

  @Get('/')
  @Paginator
  async getPagesSummary(@Query() query: PagerDto, @Lang() lang?: string) {
    const { size, select, page, sortBy, sortOrder } = query

    const result = await this.pageService.model.paginate(
      {},
      {
        limit: size,
        page,
        select,
        sort: sortBy ? { [sortBy]: sortOrder || -1 } : { order: -1 },
      },
    )

    if (!lang || !result.docs.length) {
      return result
    }

    const translationInputs: ArticleTranslationInput[] = []
    for (const doc of result.docs) {
      const originalText = doc.text
      if (doc.meta && typeof doc.meta === 'string') {
        doc.meta = JSON.safeParse(doc.meta as string) || doc.meta
      }
      if (typeof originalText === 'string') {
        translationInputs.push({
          id: doc._id?.toString?.() ?? doc.id ?? String(doc._id),
          title: doc.title,
          text: originalText,
          meta: doc.meta as { lang?: string } | undefined,
          modified: doc.modified,
          created: doc.created,
        })
      }
    }

    if (translationInputs.length) {
      const translationResults =
        await this.translationEnhancerService.enhanceListWithTranslation({
          articles: translationInputs,
          targetLang: lang,
        })

      result.docs = result.docs.map((doc) => {
        const docId = doc._id?.toString?.() ?? doc.id ?? String(doc._id)
        const translation = translationResults.get(docId)
        if (!translation?.isTranslated) {
          return doc
        }
        doc.title = translation.title
        doc.text = translation.text
        ;(doc as { isTranslated?: boolean }).isTranslated =
          translation.isTranslated
        ;(doc as { translationMeta?: unknown }).translationMeta =
          translation.translationMeta
        ;(doc as { availableTranslations?: string[] }).availableTranslations =
          translation.availableTranslations
        return doc
      })
    }

    return result
  }

  @Get('/:id')
  @Auth()
  async getPageById(@Param() params: MongoIdDto) {
    const page = this.pageService.model
      .findById(params.id)
      .lean({ getters: true })
    if (!page) {
      throw new CannotFindException()
    }
    return page
  }

  @Get('/slug/:slug')
  async getPageBySlug(@Param('slug') slug: string, @Lang() lang?: string) {
    if (typeof slug !== 'string') {
      throw new BizException(ErrorCodeEnum.InvalidSlug)
    }
    const page = await this.pageService.model
      .findOne({
        slug,
      })
      .lean({ getters: true })

    if (!page) {
      throw new CannotFindException()
    }

    page.text = await this.macroService.replaceTextMacro(page.text, page)

    const translationResult =
      await this.translationEnhancerService.enhanceWithTranslation({
        articleId: page._id?.toString?.() ?? page.id ?? String(page._id),
        targetLang: lang,
        originalData: {
          title: page.title,
          text: page.text,
        },
      })

    return {
      ...page,
      title: translationResult.title,
      text: translationResult.text,
      isTranslated: translationResult.isTranslated,
      translationMeta: translationResult.translationMeta,
      availableTranslations: translationResult.availableTranslations,
    }
  }

  @Post('/')
  @Auth()
  @HTTPDecorators.Idempotence()
  async create(@Body() body: PageDto) {
    return await this.pageService.create(body as unknown as PageModel)
  }

  @Put('/:id')
  @Auth()
  async modify(@Body() body: PageDto, @Param() params: MongoIdDto) {
    const { id } = params
    await this.pageService.updateById(id, body as unknown as PageModel)

    return await this.pageService.model.findById(id).lean()
  }

  @Patch('/:id')
  @Auth()
  async patch(@Body() body: PartialPageDto, @Param() params: MongoIdDto) {
    const { id } = params
    await this.pageService.updateById(id, body as unknown as Partial<PageModel>)

    return
  }

  @Patch('/reorder')
  @Auth()
  async reorder(@Body() body: PageReorderDto) {
    const { seq } = body
    const orders = seq.map(($) => $.order)
    const uniq = new Set(orders)
    if (uniq.size !== orders.length) {
      throw new BizException(ErrorCodeEnum.InvalidOrderValue)
    }
    const tasks = seq.map(({ id, order }) => {
      return this.pageService.model.updateOne(
        {
          _id: id,
        },
        {
          order,
        },
      )
    })
    await Promise.all(tasks)
  }

  @Delete('/:id')
  @Auth()
  async deletePage(@Param() params: MongoIdDto) {
    await this.pageService.deleteById(params.id)
    return
  }
}
