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
import type { IpRecord } from '~/common/decorators/ip.decorator'
import { IpLocation } from '~/common/decorators/ip.decorator'
import { Lang } from '~/common/decorators/lang.decorator'
import { HasAdminAccess } from '~/common/decorators/role.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { withMeta } from '~/common/response/envelope.types'
import type { EnrichmentEntry } from '~/common/response/meta.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { CountingService } from '~/processors/helper/helper.counting.service'
import {
  type ArticleTranslationInput,
  buildArticleTranslationMeta,
  TranslationService,
} from '~/processors/helper/helper.translation.service'
import { EntityIdDto } from '~/shared/dto/id.dto'

import { AiInsightsService } from '../ai/ai-insights/ai-insights.service'
import { parseLanguageCode } from '../ai/ai-language.util'
import { EnrichmentService } from '../enrichment/enrichment.service'
import {
  CategoryAndSlugDto,
  PartialPostDto,
  PostDetailQueryDto,
  PostDto,
  PostPagerDto,
  SetPostPublishStatusDto,
} from './post.schema'
import { PostService } from './post.service'
import type { PostModel } from './post.types'

@ApiController('posts')
export class PostController {
  constructor(
    private readonly postService: PostService,
    private readonly countingService: CountingService,
    private readonly translationService: TranslationService,
    private readonly aiInsightsService: AiInsightsService,
    private readonly enrichmentService: EnrichmentService,
  ) {}

  @Get('/')
  async getPaginate(
    @Query() query: PostPagerDto,
    @HasAdminAccess() isAuthenticated: boolean,
    @Lang() lang?: string,
  ) {
    const {
      size,
      page,
      year,
      sort_by: sortBy,
      sort_order: sortOrder,
      truncate,
      categoryIds,
    } = query

    const res = await this.postService.listPaginated({
      size,
      page,
      year,
      categoryIds,
      publishedOnly: !isAuthenticated,
      sortBy: sortBy as any,
      sortOrder: sortOrder === 'asc' ? 1 : -1,
    })

    const translationInputs: ArticleTranslationInput[] = []
    for (const doc of res.data) {
      const originalText = doc.text
      if (lang && typeof originalText === 'string') {
        translationInputs.push({
          id: String(doc.id),
          title: doc.title,
          text: originalText,
          summary: doc.summary,
          tags: doc.tags,
          meta: doc.meta as { lang?: string } | undefined,
          contentFormat: doc.contentFormat,
          content: doc.content,
          modifiedAt: doc.modifiedAt,
          createdAt: doc.createdAt,
        })
      }
      if (truncate) {
        doc.text = doc.text.slice(0, truncate)
        doc.content = null
      }
    }

    const translationMap =
      await this.translationService.collectArticleTranslations({
        articles: translationInputs,
        targetLang: lang,
        fields: ['title', 'text', 'summary', 'tags'],
      })

    const metaBuilder = new MetaObjectBuilder().view('card').pagination({
      page: res.pagination.currentPage,
      size: res.pagination.size,
      total: res.pagination.total,
      totalPages: res.pagination.totalPage,
    })

    if (translationMap.size > 0) {
      metaBuilder.translation(translationMap)
    }

    return withMeta(res.data, metaBuilder.build())
  }

  @Get('/get-url/:slug')
  async getBySlug(@Param('slug') slug: string) {
    if (typeof slug !== 'string') {
      throw createAppException(AppErrorCode.POST_NOT_FOUND)
    }
    const doc = await this.postService.findBySlug(slug)
    if (!doc) {
      throw createAppException(AppErrorCode.POST_NOT_FOUND)
    }

    return {
      path: `/${doc.category?.slug}/${doc.slug}`,
    }
  }

  @Get('/latest')
  async getLatest(
    @IpLocation() ip: IpRecord,
    @HasAdminAccess() isAuthenticated: boolean,
    @Lang() lang?: string,
  ) {
    const [last] = await this.postService.findRecent(1, {
      publishedOnly: !isAuthenticated,
    })
    if (!last) {
      throw createAppException(AppErrorCode.POST_NOT_FOUND)
    }
    if (!last.category?.slug)
      throw createAppException(AppErrorCode.POST_NOT_FOUND)
    return this.getByCateAndSlug(
      { category: last.category.slug, slug: last.slug },
      {} as any,
      ip,
      isAuthenticated,
      lang,
    )
  }

  @Get('/:id')
  async getById(
    @Param() params: EntityIdDto,
    @HasAdminAccess() isAuthenticated: boolean,
  ) {
    const { id } = params
    const doc = await this.postService.findById(id)
    if (!doc) {
      throw createAppException(AppErrorCode.POST_NOT_FOUND, { id })
    }

    if (!isAuthenticated && !doc.isPublished) {
      throw createAppException(AppErrorCode.POST_NOT_FOUND, { id })
    }

    const { enrichments, ...docData } =
      await this.enrichmentService.attachEnrichments(doc)
    const metaBuilder = new MetaObjectBuilder().enrichments(
      enrichments as Record<string, EnrichmentEntry>,
    )
    return withMeta(docData, metaBuilder.build())
  }

  @Get('/:category/:slug')
  async getByCateAndSlug(
    @Param() params: CategoryAndSlugDto,
    @Query() query: PostDetailQueryDto,
    @IpLocation() { ip }: IpRecord,
    @HasAdminAccess() isAuthenticated?: boolean,
    @Lang() lang?: string,
  ) {
    const { category, slug } = params
    const postDocument = await this.postService.getPostBySlug(
      category,
      slug,
      isAuthenticated,
    )
    if (!postDocument) {
      throw createAppException(AppErrorCode.POST_NOT_FOUND)
    }

    if (!isAuthenticated && !postDocument.isPublished) {
      throw createAppException(AppErrorCode.POST_NOT_FOUND)
    }

    const liked = await this.countingService.getThisRecordIsLiked(
      postDocument.id,
      ip,
    )

    const relatedList = Array.isArray((postDocument as any).related)
      ? ((postDocument as any).related as any[])
      : []
    const relatedIds = relatedList
      .map((item) => item?.id)
      .filter((id): id is string => Boolean(id))

    const insightsLang = parseLanguageCode(lang)
    const [translationResult, relatedTitleMap, hasInsightsInLocale] =
      await Promise.all([
        this.translationService.translateArticle({
          articleId: postDocument.id,
          targetLang: lang,
          allowHidden: Boolean(isAuthenticated),
          originalData: {
            title: postDocument.title,
            text: postDocument.text,
            summary: postDocument.summary,
            tags: postDocument.tags,
          },
        }),
        this.translationService.getCachedTitles(relatedIds, lang),
        this.aiInsightsService
          .hasInsightsInLang(postDocument.id, insightsLang)
          .catch(() => false),
      ])

    const translatedRelated = relatedTitleMap.size
      ? relatedList.map((item) => {
          const refId = item?.id
          const translatedTitle = refId ? relatedTitleMap.get(refId) : undefined
          return translatedTitle ? { ...item, title: translatedTitle } : item
        })
      : relatedList

    const { related: _related, ...postEntity } = postDocument
    const { enrichments, ...postData } =
      await this.enrichmentService.attachEnrichments(postEntity)

    const metaBuilder = new MetaObjectBuilder()
      .view('detail')
      .interaction({ isLiked: liked })
      .related(translatedRelated)
      .insights({ hasInLocale: hasInsightsInLocale })
      .enrichments(enrichments as Record<string, EnrichmentEntry>)

    metaBuilder.translation({
      article: buildArticleTranslationMeta(translationResult, lang, {
        summary: translationResult.summary,
        tags: translationResult.tags,
      }) as any,
    })

    return withMeta(postData, metaBuilder.build())
  }

  @Post('/')
  @Auth()
  @HTTPDecorators.Idempotence()
  async create(@Body() body: PostDto) {
    const created = await this.postService.create({
      ...(body as unknown as PostModel),
      modifiedAt: null,
      slug: body.slug,
    })
    return created
  }

  @Put('/:id')
  @Auth()
  async update(@Param() params: EntityIdDto, @Body() body: PostDto) {
    const updated = await this.postService.updateById(
      params.id,
      body as unknown as PostModel,
    )
    return updated
  }

  @Patch('/:id')
  @Auth()
  async patch(@Param() params: EntityIdDto, @Body() body: PartialPostDto) {
    await this.postService.updateById(
      params.id,
      body as unknown as Partial<PostModel>,
    )
  }

  @Delete('/:id')
  @Auth()
  async deletePost(@Param() params: EntityIdDto) {
    const { id } = params
    await this.postService.deletePost(id)
  }

  @Patch('/:id/publish')
  @Auth()
  async setPublishStatus(
    @Param() params: EntityIdDto,
    @Body() body: SetPostPublishStatusDto,
  ) {
    await this.postService.updateById(params.id, {
      isPublished: body.isPublished,
    })
    return { success: true }
  }
}
