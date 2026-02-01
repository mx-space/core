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
import { IpLocation } from '~/common/decorators/ip.decorator'
import type { IpRecord } from '~/common/decorators/ip.decorator'
import { Lang } from '~/common/decorators/lang.decorator'
import { IsAuthenticated } from '~/common/decorators/role.decorator'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { CountingService } from '~/processors/helper/helper.counting.service'
import {
  TranslationEnhancerService,
  type ArticleTranslationInput,
} from '~/processors/helper/helper.translation-enhancer.service'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { addYearCondition } from '~/transformers/db-query.transformer'
import type { PipelineStage } from 'mongoose'
import type { CategoryModel } from '../category/category.model'
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
    private readonly translationEnhancerService: TranslationEnhancerService,
  ) {}

  @Get('/')
  @Paginator
  async getPaginate(
    @Query() query: PostPagerDto,
    @IsAuthenticated() isAuthenticated: boolean,
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

    return this.postService.model
      .aggregatePaginate(
        this.postService.model.aggregate(
          [
            {
              $match: {
                ...addYearCondition(year),
                // 非认证用户只能看到已发布的文章
                ...(isAuthenticated ? {} : { isPublished: true }),
                // 分类筛选
                ...(categoryIds?.length
                  ? {
                      categoryId: {
                        $in: categoryIds.map(
                          (id) =>
                            new this.postService.model.base.Types.ObjectId(id),
                        ),
                      },
                    }
                  : {}),
              },
            },
            // @see https://stackoverflow.com/questions/54810712/mongodb-sort-by-field-a-if-field-b-null-otherwise-sort-by-field-c
            {
              $addFields: {
                sortField: {
                  // create a new field called "sortField"
                  $cond: {
                    // and assign a value that depends on
                    if: { $ne: ['$pin', null] }, // whether "b" is not null
                    then: '$pinOrder', // in which case our field shall hold the value of "a"
                    else: '$$REMOVE',
                  },
                },
              },
            },
            {
              $sort: sortBy
                ? {
                    [sortBy]: sortOrder as any,
                  }
                : {
                    sortField: -1, // sort by our computed field
                    pin: -1,
                    created: -1, // and then by the "created" field
                  },
            },
            {
              $project: {
                sortField: 0, // remove "sort" field if needed
              },
            },
            select && {
              $project: {
                ...select
                  .split(' ')
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .reduce(
                    (acc, field) => {
                      acc[field] = 1
                      return acc
                    },
                    {} as Record<string, 1>,
                  ),
              },
            },
            {
              $lookup: {
                from: 'categories',
                localField: 'categoryId',
                foreignField: '_id',
                as: 'category',
              },
            },
            {
              $unwind: {
                path: '$category',
                preserveNullAndEmptyArrays: true,
              },
            },
          ].filter(Boolean) as PipelineStage[],
        ),
        {
          limit: size,
          page,
        },
      )
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
              modified: doc.modified,
            })
          }

          doc.text = truncate ? doc.text.slice(0, truncate) : doc.text
        }

        if (lang && translationInputs.length) {
          const translationResults =
            await this.translationEnhancerService.enhanceListWithTranslation({
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
    const doc = await this.postService.model.findOne({ slug })
    if (!doc) {
      throw new CannotFindException()
    }

    return {
      path: `/${(doc.category as CategoryModel).slug}/${doc.slug}`,
    }
  }

  @Get('/:id')
  async getById(
    @Param() params: MongoIdDto,
    @IsAuthenticated() isAuthenticated: boolean,
  ) {
    const { id } = params
    const doc = await this.postService.model
      .findById(id)
      .populate('category')
      .populate({
        path: 'related',
        select: 'title slug id _id categoryId category',
      })
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
  async getLatest(
    @IpLocation() ip: IpRecord,
    @IsAuthenticated() isAuthenticated: boolean,
  ) {
    const query: any = {}

    // 非认证用户只能看到已发布的文章
    if (!isAuthenticated) {
      query.isPublished = true
    }

    const last = await this.postService.model
      .findOne(query)
      .sort({ created: -1 })
      .lean({ getters: true, autopopulate: true })
    if (!last) {
      throw new CannotFindException()
    }
    return this.getByCateAndSlug(
      {
        category: (last.category as CategoryModel).slug,
        slug: last.slug,
      },
      {} as PostDetailQueryDto,
      ip,
      isAuthenticated,
    )
  }

  @Get('/:category/:slug')
  async getByCateAndSlug(
    @Param() params: CategoryAndSlugDto,
    @Query() _query: PostDetailQueryDto,
    @IpLocation() { ip }: IpRecord,
    @IsAuthenticated() isAuthenticated?: boolean,
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

    const baseData = postDocument.toObject()
    const translationResult =
      await this.translationEnhancerService.enhanceWithTranslation({
        articleId: postDocument.id,
        targetLang: lang,
        allowHidden: Boolean(isAuthenticated),
        originalData: {
          title: baseData.title,
          text: baseData.text,
          summary: baseData.summary,
          tags: baseData.tags,
        },
      })

    return {
      ...baseData,
      title: translationResult.title,
      text: translationResult.text,
      summary: translationResult.summary,
      tags: translationResult.tags,
      isTranslated: translationResult.isTranslated,
      translationMeta: translationResult.translationMeta,
      availableTranslations: translationResult.availableTranslations,
      liked,
    }
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
  async update(@Param() params: MongoIdDto, @Body() body: PostDto) {
    return await this.postService.updateById(
      params.id,
      body as unknown as PostModel,
    )
  }

  @Patch('/:id')
  @Auth()
  async patch(@Param() params: MongoIdDto, @Body() body: PartialPostDto) {
    await this.postService.updateById(
      params.id,
      body as unknown as Partial<PostModel>,
    )
    return
  }

  @Delete('/:id')
  @Auth()
  async deletePost(@Param() params: MongoIdDto) {
    const { id } = params
    await this.postService.deletePost(id)

    return
  }

  @Patch('/:id/publish')
  @Auth()
  async setPublishStatus(
    @Param() params: MongoIdDto,
    @Body() body: SetPostPublishStatusDto,
  ) {
    await this.postService.updateById(params.id, {
      isPublished: body.isPublished,
    })
    return { success: true }
  }
}
