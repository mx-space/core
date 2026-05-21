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
import type { EnrichmentEntry } from '~/common/response/meta.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import {
  type ArticleTranslationInput,
  buildArticleTranslationMeta,
  TranslationService,
} from '~/processors/helper/helper.translation.service'
import { EntityIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'

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
  async getPagesSummary(@Query() query: PagerDto, @Lang() lang?: string) {
    const { size, page } = query
    const result = await this.pageService.listPaginated(page, size)

    const translationMap = new Map<string, any>()

    if (lang && result.data.length) {
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

      for (const [id, translation] of translationResults) {
        if (translation?.isTranslated) {
          translationMap.set(id, {
            article: {
              is_translated: translation.isTranslated,
              source_lang: translation.sourceLang,
              target_lang: lang,
              title: translation.title,
              text: translation.text,
              subtitle: translation.subtitle,
            },
          })
        }
      }
    }

    const metaBuilder = new MetaObjectBuilder().view('card').pagination({
      page: result.pagination.currentPage,
      size: result.pagination.size,
      total: result.pagination.total,
      total_pages: result.pagination.totalPage,
    })
    if (translationMap.size > 0) metaBuilder.translation(translationMap as any)

    return withMeta(result.data, metaBuilder.build())
  }

  @Get('/:id')
  @Auth()
  async getPageById(@Param() params: EntityIdDto) {
    const page = await this.pageService.findById(params.id)
    if (!page) {
      throw createAppException(AppErrorCode.PAGE_NOT_FOUND, { id: params.id })
    }
    const { enrichments, ...pageData } =
      await this.enrichmentService.attachEnrichments(page)
    const metaBuilder = new MetaObjectBuilder().enrichments(
      enrichments as Record<string, EnrichmentEntry>,
    )
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

    const { enrichments, ...pageData } =
      await this.enrichmentService.attachEnrichments(page)

    const metaBuilder = new MetaObjectBuilder()
      .view('detail')
      .enrichments(enrichments as Record<string, EnrichmentEntry>)

    metaBuilder.translation({
      article: buildArticleTranslationMeta(translationResult, lang, {
        subtitle: translationResult.subtitle,
      }) as any,
    })

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
