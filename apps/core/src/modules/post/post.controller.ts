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
import type { IpRecord } from '~/common/decorators/ip.decorator'
import { IpLocation } from '~/common/decorators/ip.decorator'
import { Lang } from '~/common/decorators/lang.decorator'
import { HasAdminAccess } from '~/common/decorators/role.decorator'
import { TranslateFields } from '~/common/decorators/translate-fields.decorator'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { CountingService } from '~/processors/helper/helper.counting.service'
import {
  type ArticleTranslationInput,
  TranslationService,
} from '~/processors/helper/helper.translation.service'
import { EntityIdDto } from '~/shared/dto/id.dto'
import { applyContentPreference } from '~/utils/content.util'

import { AiInsightsService } from '../ai/ai-insights/ai-insights.service'
import { parseLanguageCode } from '../ai/ai-language.util'
import { PostModel } from './post.model'
import {
  CategoryAndSlugDto,
  PartialPostDto,
  PostDetailQueryDto,
  PostDto,
  PostPagerDto,
  SetPostPublishStatusDto,
} from './post.schema'
import { PostService } from './post.service'

@ApiController('posts')
export class PostController {
  constructor(
    private readonly postService: PostService,
    private readonly countingService: CountingService,
    private readonly translationService: TranslationService,
    private readonly aiInsightsService: AiInsightsService,
  ) {}

  @Get('/')
  @Paginator
  @TranslateFields({
    path: 'docs[].category.name',
    keyPath: 'category.name',
    idField: '_id',
  })
  async getPaginate(
    @Query() query: PostPagerDto,
    @HasAdminAccess() isAuthenticated: boolean,
    @Lang() lang?: string,
  ) {
    const {
      size,
      select,
      page,
      year,
      sortBy,
      sortOrder,
      truncate,
      categoryIds,
    } = query

    return this.postService
      .listPaginated({
        size,
        page,
        year,
        categoryIds,
        publishedOnly: !isAuthenticated,
        sortBy: sortBy as any,
        sortOrder: sortOrder as 1 | -1 | undefined,
      })
      .then(async (res) => {
        const translationInputs: ArticleTranslationInput[] = []
        for (const doc of res.docs) {
          const originalText = doc.text
          if (doc.meta && typeof doc.meta === 'string') {
            doc.meta = JSON.safeParse(doc.meta as string) || doc.meta
          }

          if (lang && typeof originalText === 'string') {
            translationInputs.push({
              id: doc._id?.toString?.() ?? doc.id ?? String(doc._id),
              title: doc.title,
              text: originalText,
              summary: doc.summary,
              tags: doc.tags,
              meta: doc.meta,
              contentFormat: doc.contentFormat,
              content: doc.content,
              modified: doc.modified,
              created: doc.created,
            })
          }

          doc.text = truncate ? doc.text.slice(0, truncate) : doc.text
        }

        if (select) {
          const selected = new Set(
            select
              .split(' ')
              .map((s) => s.trim().replace(/^[+-]/, ''))
              .filter(Boolean),
          )
          res.docs = res.docs.map((doc) =>
            Object.fromEntries(
              Object.entries(doc).filter(([key]) => selected.has(key)),
            ),
          )
        }

        if (lang && translationInputs.length) {
          const translationResults =
            await this.translationService.translateArticleList({
              articles: translationInputs,
              targetLang: lang,
            })

          res.docs = res.docs.map((doc) => {
            const docId = doc._id?.toString?.() ?? doc.id ?? String(doc._id)
            const translation = translationResults.get(docId)
            if (!translation?.isTranslated) {
              return doc
            }

            return {
              ...doc,
              title: translation.title,
              text: translation.text,
              summary: translation.summary,
              tags: translation.tags,
              isTranslated: translation.isTranslated,
              translationMeta: translation.translationMeta,
            }
          })
        }

        return res
      })
  }

  @Get('/get-url/:slug')
  async getBySlug(@Param('slug') slug: string) {
    if (typeof slug !== 'string') {
      throw new CannotFindException()
    }
    const doc = await this.postService.findBySlug(slug)
    if (!doc) {
      throw new CannotFindException()
    }

    return {
      path: `/${doc.category?.slug}/${doc.slug}`,
    }
  }

  @Get('/:id')
  @TranslateFields({
    path: 'category.name',
    keyPath: 'category.name',
    idField: '_id',
  })
  async getById(
    @Param() params: EntityIdDto,
    @HasAdminAccess() isAuthenticated: boolean,
  ) {
    const { id } = params
    const doc = await this.postService.findById(id)
    if (!doc) {
      throw new CannotFindException()
    }

    // 非认证用户只能查看已发布的文章
    if (!isAuthenticated && !doc.isPublished) {
      throw new CannotFindException()
    }

    return doc
  }

  @Get('/latest')
  @TranslateFields({
    path: 'category.name',
    keyPath: 'category.name',
    idField: '_id',
  })
  async getLatest(
    @IpLocation() ip: IpRecord,
    @HasAdminAccess() isAuthenticated: boolean,
    @Lang() lang?: string,
  ) {
    const [last] = await this.postService.findRecent(1, {
      publishedOnly: !isAuthenticated,
    })
    if (!last) {
      throw new CannotFindException()
    }
    return this.getByCateAndSlug(
      {
        category: last.category?.slug,
        slug: last.slug,
      },
      {} as any,
      ip,
      isAuthenticated,
      lang,
    )
  }

  @Get('/:category/:slug')
  @TranslateFields({
    path: 'category.name',
    keyPath: 'category.name',
    idField: '_id',
  })
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
      throw new CannotFindException()
    }

    // 非认证用户只能查看已发布的文章
    if (!isAuthenticated && !postDocument.isPublished) {
      throw new CannotFindException()
    }

    const liked = await this.countingService.getThisRecordIsLiked(
      postDocument.id,
      ip,
    )

    const baseData =
      typeof postDocument.toObject === 'function'
        ? postDocument.toObject()
        : postDocument
    const relatedList = Array.isArray(baseData.related)
      ? (baseData.related as any[])
      : []
    const relatedIds = relatedList
      .map((item) => item?._id?.toString?.() ?? item?.id)
      .filter((id): id is string => Boolean(id))

    const insightsLang = parseLanguageCode(lang)
    const [translationResult, relatedTitleMap, hasInsightsInLocale] =
      await Promise.all([
        this.translationService.translateArticle({
          articleId: postDocument.id,
          targetLang: lang,
          allowHidden: Boolean(isAuthenticated),
          originalData: {
            title: baseData.title,
            text: baseData.text,
            summary: baseData.summary,
            tags: baseData.tags,
          },
        }),
        this.translationService.getCachedTitles(relatedIds, lang),
        this.aiInsightsService
          .hasInsightsInLang(postDocument.id, insightsLang)
          .catch(() => false),
      ])

    const translatedRelated = relatedTitleMap.size
      ? relatedList.map((item) => {
          const refId = item?._id?.toString?.() ?? item?.id
          const translatedTitle = refId ? relatedTitleMap.get(refId) : undefined
          return translatedTitle ? { ...item, title: translatedTitle } : item
        })
      : relatedList

    return applyContentPreference(
      {
        ...baseData,
        related: translatedRelated,
        title: translationResult.title,
        text: translationResult.text,
        summary: translationResult.summary,
        tags: translationResult.tags,
        ...(translationResult.content && {
          content: translationResult.content,
          contentFormat: translationResult.contentFormat,
        }),
        isTranslated: translationResult.isTranslated,
        sourceLang: translationResult.sourceLang,
        translationMeta: translationResult.translationMeta,
        availableTranslations: translationResult.availableTranslations,
        hasInsightsInLocale,
        liked,
      },
      query.prefer,
    )
  }

  @Post('/')
  @Auth()
  @HTTPDecorators.Idempotence()
  async create(@Body() body: PostDto) {
    return await this.postService.create({
      ...(body as unknown as PostModel),
      modified: null,
      slug: body.slug,
      related: body.relatedId as any,
    })
  }

  @Put('/:id')
  @Auth()
  async update(@Param() params: EntityIdDto, @Body() body: PostDto) {
    return await this.postService.updateById(
      params.id,
      body as unknown as PostModel,
    )
  }

  @Patch('/:id')
  @Auth()
  async patch(@Param() params: EntityIdDto, @Body() body: PartialPostDto) {
    await this.postService.updateById(
      params.id,
      body as unknown as Partial<PostModel>,
    )
    return
  }

  @Delete('/:id')
  @Auth()
  async deletePost(@Param() params: EntityIdDto) {
    const { id } = params
    await this.postService.deletePost(id)

    return
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
