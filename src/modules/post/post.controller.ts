import { Types } from 'mongoose'

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import { ApiOperation } from '@nestjs/swagger'

import { Auth } from '~/common/decorator/auth.decorator'
import { Paginator } from '~/common/decorator/http.decorator'
import { IpLocation, IpRecord } from '~/common/decorator/ip.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { IsMaster } from '~/common/decorator/role.decorator'
import { VisitDocument } from '~/common/decorator/update-count.decorator'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { CountingService } from '~/processors/helper/helper.counting.service'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { addYearCondition } from '~/transformers/db-query.transformer'
import { macros } from '~/utils/macros.util'

import { CategoryAndSlugDto, PostQueryDto } from './post.dto'
import { PartialPostModel, PostModel } from './post.model'
import { PostService } from './post.service'

@Controller('posts')
@ApiName
export class PostController {
  constructor(
    private readonly postService: PostService,
    private readonly countingService: CountingService,
  ) {}

  @Get('/')
  @Paginator
  async getPaginate(@Query() query: PostQueryDto, @IsMaster() master: boolean) {
    const { size, select, page, year, sortBy, sortOrder } = query

    return await this.postService.findWithPaginator(
      {
        ...addYearCondition(year),
      },
      {
        limit: size,
        page,
        select,
        sort: sortBy ? { [sortBy]: sortOrder || -1 } : { created: -1 },
      },
    )
  }

  @Get('/:id')
  @VisitDocument('Post')
  async getById(@Param() params: MongoIdDto) {
    const { id } = params
    const doc = await this.postService.model.findById(id).populate('category')
    if (!doc) {
      throw new CannotFindException()
    }
    doc.text = macros(doc.text, doc)
    return doc
  }

  @Get('/latest')
  @VisitDocument('Post')
  async getLatest() {
    return this.postService.model.findOne({}).sort({ created: -1 }).lean()
  }

  @Get('/:category/:slug')
  @ApiOperation({ summary: '根据分类名和自定义别名获取' })
  @VisitDocument('Post')
  async getByCateAndSlug(@Param() params: CategoryAndSlugDto) {
    const { category, slug } = params

    const categoryDocument = await this.postService.getCategoryBySlug(category)
    if (!categoryDocument) {
      throw new NotFoundException('该分类未找到 (｡•́︿•̀｡)')
    }

    const postDocument = await this.postService.model
      .findOne({
        slug,
        categoryId: categoryDocument._id,
        // ...condition,
      })
      .populate('category')

    if (!postDocument) {
      throw new CannotFindException()
    }
    return postDocument.toJSON()
  }

  @Post('/')
  @Auth()
  @HttpCode(201)
  async create(@Body() body: PostModel) {
    const _id = new Types.ObjectId()

    return await this.postService.create({
      ...body,
      created: new Date(),
      modified: null,
      slug: body.slug ?? _id.toHexString(),
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
    return await this.postService.updateById(params.id, body)
  }

  @Delete('/:id')
  @Auth()
  @HttpCode(204)
  async deletePost(@Param() params: MongoIdDto) {
    const { id } = params
    await this.postService.deletePost(id)

    return
  }

  @Get('/_thumbs-up')
  @HttpCode(204)
  async thumbsUpArticle(
    @Query() query: MongoIdDto,
    @IpLocation() location: IpRecord,
  ) {
    const { ip } = location
    const { id } = query
    try {
      const res = await this.countingService.updateLikeCount('Post', id, ip)
      if (!res) {
        throw new BadRequestException('你已经支持过啦!')
      }
    } catch (e: any) {
      throw new BadRequestException(e)
    }

    return
  }
}
