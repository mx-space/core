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
import { AppErrorCode, createAppException } from '~/common/errors'
import { withMeta } from '~/common/response/envelope.types'
import type {
  ArticleTranslation,
  EnrichmentEntry,
} from '~/common/response/meta.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import {
  applyArticleTranslationInPlace,
  type ArticleTranslationInput,
  buildArticleTranslationMeta,
  TranslationService,
} from '~/processors/helper/helper.translation.service'
import { EntityIdDto } from '~/shared/dto/id.dto'
import { BasicPagerDto } from '~/shared/dto/pager.dto'

import { EnrichmentService } from '../enrichment/enrichment.service'
import {
  PageDetailQueryDto,
  PageDto,
  PageReorderDto,
  PartialPageDto,
} from './page.schema'
import { PageService } from './page.service'
import type { PageModel } from './page.types'

@ApiController('pages')
export class PageController {
  constructor(
    private readonly pageService: PageService,
    private readonly translationService: TranslationService,
    private readonly enrichmentService: EnrichmentService,
  ) {}

  @Get('/')
  async getPagesSummary(@Query() query: BasicPagerDto, @Lang() lang?: string) {
    const { size, page } = query
    const result = await this.pageService.listPaginated(page, size)

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

    const { results: translationResults, meta: translationMeta } =
      await this.translationService.collectArticleTranslations({
        articles: translationInputs,
        targetLang: lang,
        fields: ['title', 'text', 'subtitle', 'content', 'contentFormat'],
      })

    for (const doc of result.data) {
      const tr = translationResults.get(String(doc.id))
      if (tr?.isTranslated) {
        applyArticleTranslationInPlace(doc as Record<string, any>, tr as any, {
          fields: ['title', 'text', 'subtitle', 'content', 'contentFormat'],
        })
      }
    }

    const metaBuilder = new MetaObjectBuilder().view('card').pagination({
      page: result.pagination.currentPage,
      size: result.pagination.size,
      total: result.pagination.total,
      totalPages: result.pagination.totalPage,
    })
    if (translationMeta.size > 0) metaBuilder.translation(translationMeta)

    return withMeta(result.data, metaBuilder.build())
  }

  @Get('/:id')
  @Auth()
  async getPageById(@Param() params: EntityIdDto, @Lang() lang?: string) {
    const page = await this.pageService.findById(params.id)
    if (!page) {
      throw createAppException(AppErrorCode.PAGE_NOT_FOUND, { id: params.id })
    }

    const translationResult = await this.translationService.translateArticle({
      articleId: String(page.id),
      targetLang: lang,
      originalData: {
        title: page.title,
        text: page.text,
        subtitle: page.subtitle,
      },
    })

    applyArticleTranslationInPlace(
      page as Record<string, any>,
      translationResult,
      {
        fields: ['title', 'text', 'subtitle', 'content', 'contentFormat'],
      },
    )

    const { enrichments, ...pageData } =
      await this.enrichmentService.attachEnrichments(page)

    const metaBuilder = new MetaObjectBuilder().enrichments(
      enrichments as Record<string, EnrichmentEntry>,
    )

    const translationMap = new Map([
      [
        String(page.id),
        {
          article: buildArticleTranslationMeta(
            translationResult,
            lang,
          ) as ArticleTranslation,
        },
      ],
    ])
    metaBuilder.translation(translationMap)

    return withMeta(pageData, metaBuilder.build())
  }

  @Get('/slug/:slug')
  async getPageBySlug(
    @Param('slug') slug: string,
    @Query() query: PageDetailQueryDto,
    @Lang() lang?: string,
  ) {
    if (typeof slug !== 'string') {
      throw createAppException(AppErrorCode.PAGE_NOT_FOUND)
    }
    const page = await this.pageService.findBySlug(slug)
    if (!page) {
      throw createAppException(AppErrorCode.PAGE_NOT_FOUND)
    }

    const translationResult = await this.translationService.translateArticle({
      articleId: String(page.id),
      targetLang: lang,
      originalData: {
        title: page.title,
        text: page.text,
        subtitle: page.subtitle,
      },
    })

    applyArticleTranslationInPlace(
      page as Record<string, any>,
      translationResult,
      {
        fields: ['title', 'text', 'subtitle', 'content', 'contentFormat'],
      },
    )

    const { enrichments, ...pageData } =
      await this.enrichmentService.attachEnrichments(page)

    const metaBuilder = new MetaObjectBuilder()
      .view('detail')
      .enrichments(enrichments as Record<string, EnrichmentEntry>)

    const translationMap = new Map([
      [
        String(page.id),
        {
          article: buildArticleTranslationMeta(
            translationResult,
            lang,
          ) as ArticleTranslation,
        },
      ],
    ])
    metaBuilder.translation(translationMap)

    return withMeta(pageData, metaBuilder.build())
  }

  @Post('/')
  @Auth()
  @HTTPDecorators.Idempotence()
  async create(@Body() body: PageDto) {
    const created = await this.pageService.create(body as unknown as PageModel)
    return created
  }

  @Put('/:id')
  @Auth()
  async modify(@Body() body: PageDto, @Param() params: EntityIdDto) {
    const { id } = params
    await this.pageService.updateById(id, body as unknown as PageModel)
    const updated = await this.pageService.findById(id)
    return updated
  }

  @Patch('/:id')
  @Auth()
  async patch(@Body() body: PartialPageDto, @Param() params: EntityIdDto) {
    const { id } = params
    await this.pageService.updateById(id, body as unknown as Partial<PageModel>)
  }

  @Patch('/reorder')
  @Auth()
  async reorder(@Body() body: PageReorderDto) {
    const { seq } = body
    const orders = seq.map(($) => $.order)
    const uniq = new Set(orders)
    if (uniq.size !== orders.length) {
      throw createAppException(AppErrorCode.INVALID_ORDER_VALUE)
    }
    const tasks = seq.map(({ id, order }) => {
      return this.pageService.updateOrder(id, order)
    })
    await Promise.all(tasks)
    return { success: true }
  }

  @Delete('/:id')
  @Auth()
  async deletePage(@Param() params: EntityIdDto) {
    await this.pageService.deleteById(params.id)
  }
}
