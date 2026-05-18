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
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { Lang } from '~/common/decorators/lang.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import {
  type ArticleTranslationInput,
  TranslationService,
} from '~/processors/helper/helper.translation.service'
import { EntityIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'
import { applyContentPreference } from '~/utils/content.util'

import { EnrichmentService } from '../enrichment/enrichment.service'
import {
  PageDetailQueryDto,
  PageDto,
  PageReorderDto,
  PartialPageDto,
} from './page.schema'
import { PageService } from './page.service'
import { PageModel } from './page.types'

@ApiController('pages')
export class PageController {
  constructor(
    private readonly pageService: PageService,
    private readonly translationService: TranslationService,
    private readonly enrichmentService: EnrichmentService,
  ) {}

  private async buildPageDetailResponse(
    page: PageModel,
    query: PageDetailQueryDto,
    lang?: string,
  ) {
    const translationResult = await this.translationService.translateArticle({
      articleId: String(page.id),
      targetLang: lang,
      originalData: {
        title: page.title,
        text: page.text,
        subtitle: page.subtitle,
      },
    })

    const finalDoc = applyContentPreference(
      {
        ...page,
        title: translationResult.title,
        text: translationResult.text,
        subtitle: translationResult.subtitle,
        ...(translationResult.content && {
          content: translationResult.content,
          contentFormat: translationResult.contentFormat,
        }),
        isTranslated: translationResult.isTranslated,
        sourceLang: translationResult.sourceLang,
        translationMeta: translationResult.translationMeta,
        availableTranslations: translationResult.availableTranslations,
      },
      query.prefer,
    )
    return this.enrichmentService.attachEnrichments(finalDoc)
  }

  @Get('/')
  async getPagesSummary(@Query() query: PagerDto, @Lang() lang?: string) {
    const { size, select, page } = query
    const result = await this.pageService.listPaginated(page, size)

    if (!lang || !result.data.length) {
      return result
    }

    const translationInputs: ArticleTranslationInput[] = result.data.map(
      (doc) => ({
        id: String(doc.id),
        title: doc.title,
        text: doc.text,
        subtitle: doc.subtitle,
        meta: doc.meta as { lang?: string } | undefined,
        contentFormat: doc.contentFormat,
        content: doc.content,
        modifiedAt: doc.modifiedAt,
        createdAt: doc.createdAt,
      }),
    )

    const translationResults =
      await this.translationService.translateArticleList({
        articles: translationInputs,
        targetLang: lang,
      })

    result.data = result.data.map((doc) => {
      const translation = translationResults.get(String(doc.id))
      if (!translation?.isTranslated) {
        return doc
      }
      doc.title = translation.title
      doc.text = translation.text
      doc.subtitle = translation.subtitle ?? null
      ;(doc as { isTranslated?: boolean }).isTranslated =
        translation.isTranslated
      ;(doc as { translationMeta?: unknown }).translationMeta =
        translation.translationMeta
      return doc
    })

    // Strip fields fetched only for translation when caller did not request them.
    if (select) {
      const TRANSLATION_FIELDS = [
        'text',
        'meta',
        'subtitle',
        'content',
        'contentFormat',
        'modified',
        'created',
      ]
      const stripFields = TRANSLATION_FIELDS.filter((f) => !select.includes(f))
      for (const doc of result.data) {
        for (const field of stripFields) {
          delete (doc as any)[field]
        }
      }
    }

    return result
  }

  @Get('/:id')
  @Auth()
  async getPageById(
    @Param() params: EntityIdDto,
    @Query() query: PageDetailQueryDto,
    @Lang() lang?: string,
  ) {
    const page = await this.pageService.findById(params.id)
    if (!page) {
      throw new CannotFindException()
    }
    return this.buildPageDetailResponse(page, query, lang)
  }

  @Get('/slug/:slug')
  async getPageBySlug(
    @Param('slug') slug: string,
    @Query() query: PageDetailQueryDto,
    @Lang() lang?: string,
  ) {
    if (typeof slug !== 'string') {
      throw new BizException(ErrorCodeEnum.InvalidSlug)
    }
    const page = await this.pageService.findBySlug(slug)

    if (!page) {
      throw new CannotFindException()
    }

    return this.buildPageDetailResponse(page, query, lang)
  }

  @Post('/')
  @Auth()
  @HTTPDecorators.Idempotence()
  async create(@Body() body: PageDto) {
    return await this.pageService.create(body as unknown as PageModel)
  }

  @Put('/:id')
  @Auth()
  async modify(@Body() body: PageDto, @Param() params: EntityIdDto) {
    const { id } = params
    await this.pageService.updateById(id, body as unknown as PageModel)

    return await this.pageService.findById(id)
  }

  @Patch('/:id')
  @Auth()
  async patch(@Body() body: PartialPageDto, @Param() params: EntityIdDto) {
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
      return this.pageService.updateOrder(id, order)
    })
    await Promise.all(tasks)
  }

  @Delete('/:id')
  @Auth()
  async deletePage(@Param() params: EntityIdDto) {
    await this.pageService.deleteById(params.id)
    return
  }
}
