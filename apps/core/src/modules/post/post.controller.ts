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
import { IpLocation, IpRecord } from '~/common/decorators/ip.decorator'
import { IsAuthenticated } from '~/common/decorators/role.decorator'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { CountingService } from '~/processors/helper/helper.counting.service'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { addYearCondition } from '~/transformers/db-query.transformer'
import type { PipelineStage } from 'mongoose'
import type { CategoryModel } from '../category/category.model'
import {
  CategoryAndSlugDto,
  PostPagerDto,
  SetPostPublishStatusDto,
} from './post.dto'
import { PartialPostModel, PostModel } from './post.model'
import { PostService } from './post.service'

@ApiController('posts')
export class PostController {
  constructor(
    private readonly postService: PostService,
    private readonly countingService: CountingService,
  ) {}

  @Get('/')
  @Paginator
  async getPaginate(
    @Query() query: PostPagerDto,
    @IsAuthenticated() isAuthenticated: boolean,
  ) {
    const { size, select, page, year, sortBy, sortOrder, truncate } = query

    return this.postService.model
      .aggregatePaginate(
        this.postService.model.aggregate(
          [
            {
              $match: {
                ...addYearCondition(year),
                // 非认证用户只能看到已发布的文章
                ...(isAuthenticated ? {} : { isPublished: true }),
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
                ...(select?.split(' ').reduce(
                  (acc, cur) => {
                    const field = cur.trim()
                    acc[field] = 1
                    return acc
                  },
                  Object.keys(new PostModel()).map((k) => ({ [k]: 0 })),
                ) as any),
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
      .then((res) => {
        res.docs = res.docs.map((doc: PostModel) => {
          doc.text = truncate ? doc.text.slice(0, truncate) : doc.text
          if (doc.meta && typeof doc.meta === 'string') {
            doc.meta = JSON.safeParse(doc.meta as string) || doc.meta
          }
          return doc
        })
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
      ip,
      isAuthenticated,
    )
  }

  @Get('/:category/:slug')
  async getByCateAndSlug(
    @Param() params: CategoryAndSlugDto,
    @IpLocation() { ip }: IpRecord,
    @IsAuthenticated() isAuthenticated?: boolean,
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

    return { ...postDocument.toObject(), liked }
  }

  @Post('/')
  @Auth()
  @HTTPDecorators.Idempotence()
  async create(@Body() body: PostModel) {
    return await this.postService.create({
      ...body,
      modified: null,
      slug: body.slug,
      related: body.relatedId as any,
    })
  }

  @Put('/:id')
  @Auth()
  async update(@Param() params: MongoIdDto, @Body() body: PostModel) {
    return await this.postService.updateById(params.id, body)
  }

  @Patch('/:id')
  @Auth()
  async patch(@Param() params: MongoIdDto, @Body() body: PartialPostModel) {
    await this.postService.updateById(params.id, body)
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
