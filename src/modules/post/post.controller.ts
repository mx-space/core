import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Types } from 'mongoose'
import { Paginator } from '~/common/decorator/http.decorator'
import { IpLocation, IpRecord } from '~/common/decorator/ip.decorator'
import { IsMaster } from '~/common/decorator/role.decorator'
import { MongoIdDto } from '~/shared/dto/id.dto'
import {
  addConditionToSeeHideContent,
  addYearCondition,
} from '~/utils/query.util'
import { RolesGuard } from '../auth/roles.guard'
import { CategoryAndSlug, PostQueryDto } from './post.dto'
import { PartialPostModel, PostModel } from './post.model'
import { PostService } from './post.service'

@Controller('posts')
@ApiTags('Post Routes')
@UseGuards(RolesGuard)
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Get('/')
  @Paginator
  async getPaginate(@Query() query: PostQueryDto, @IsMaster() master: boolean) {
    const { size, select = '-text', page, year, sortBy, sortOrder } = query

    return await this.postService.findWithPaginator(
      {
        ...addYearCondition(year),
        ...addConditionToSeeHideContent(master),
      },
      {
        limit: size,
        page,
        select,
        sort: sortBy ? { [sortBy]: sortOrder || -1 } : { created: -1 },
        populate: 'category',
      },
    )
  }

  @Get('/:category/:slug')
  @ApiOperation({ summary: '根据分类名和自定义别名获取' })
  async getByCateAndSlug(
    @Param() params: CategoryAndSlug,
    @IpLocation() location: IpRecord,
  ) {
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
      throw new NotFoundException('该文章未找到 (｡ŏ_ŏ)')
    }
    // TODO
    // this.service.updateReadCount(postDocument, location.ip)
    return postDocument
  }

  @Post('/')
  async create(@Body() body: PostModel) {
    const _id = Types.ObjectId()

    return await this.postService.create({
      ...body,
      slug: body.slug ?? _id.toHexString(),
    })
  }

  @Put('/:id')
  async update(@Param() params: MongoIdDto, @Body() body: PostModel) {
    await this.postService.updateById(params.id, body)
    return this.postService.findById(params.id)
  }

  @Patch('/:id')
  @HttpCode(204)
  async patch(@Param() params: MongoIdDto, @Body() body: PartialPostModel) {
    return await this.postService.updateById(params.id, body)
  }
}
