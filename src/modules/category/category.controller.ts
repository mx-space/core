import { isValidObjectId } from 'mongoose'

import {
  BadRequestException,
  Body,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  forwardRef,
} from '@nestjs/common'
import { ApiQuery } from '@nestjs/swagger'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { ApiName } from '~/common/decorators/openapi.decorator'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { NoContentCanBeModifiedException } from '~/common/exceptions/no-content-canbe-modified.exception'
import { MongoIdDto } from '~/shared/dto/id.dto'

import { PostService } from '../post/post.service'
import {
  MultiCategoriesQueryDto,
  MultiQueryTagAndCategoryDto,
  SlugOrIdDto,
} from './category.dto'
import {
  CategoryModel,
  CategoryType,
  PartialCategoryModel,
} from './category.model'
import { CategoryService } from './category.service'

@ApiController({ path: 'categories' })
@ApiName
export class CategoryController {
  constructor(
    private readonly categoryService: CategoryService,
    @Inject(forwardRef(() => PostService))
    private readonly postService: PostService,
  ) {}

  @Get('/')
  async getCategories(@Query() query: MultiCategoriesQueryDto) {
    const { ids, joint, type = CategoryType.Category } = query // categories is category's mongo id
    if (ids) {
      const ignoreKeys = '-text -summary -hide -images -commentsIndex'
      if (joint) {
        const map = new Object()

        await Promise.all(
          ids.map(async (id) => {
            const item = await this.postService.model
              .find({ categoryId: id }, ignoreKeys)
              .sort({ created: -1 })
              .lean()

            map[id] = item
            return id
          }),
        )

        return { entries: map }
      } else {
        const map = new Object()

        await Promise.all(
          ids.map(async (id) => {
            const posts = await this.postService.model
              .find({ categoryId: id }, ignoreKeys)
              .sort({ created: -1 })
              .lean()
            const category = await this.categoryService.findCategoryById(id)
            map[id] = Object.assign({ ...category, children: posts })
            return id
          }),
        )

        return { entries: map }
      }
    }
    return type === CategoryType.Category
      ? await this.categoryService.findAllCategory()
      : await this.categoryService.getPostTagsSum()
  }

  @Get('/:query')
  @ApiQuery({
    description: '混合查询 分类 和 标签云',
    name: 'tag',
    enum: ['true', 'false'],
    required: false,
  })
  async getCategoryById(
    @Param() { query }: SlugOrIdDto,
    @Query() { tag }: MultiQueryTagAndCategoryDto,
  ) {
    if (!query) {
      throw new BadRequestException()
    }
    if (tag === true) {
      return {
        tag: query,
        data: await this.categoryService.findArticleWithTag(query),
      }
    }

    const isId = isValidObjectId(query)
    const res = isId
      ? await this.categoryService.model
          .findById(query)
          .sort({ created: -1 })
          .lean()
      : await this.categoryService.model
          .findOne({ slug: query })
          .sort({ created: -1 })
          .lean()

    if (!res) {
      throw new CannotFindException()
    }

    const children =
      (await this.categoryService.findCategoryPost(res._id, {
        $and: [tag ? { tags: tag } : {}],
      })) || []
    return { data: { ...res, children } }
  }

  @Post('/')
  @Auth()
  @HTTPDecorators.Idempotence()
  async create(@Body() body: CategoryModel) {
    const { name, slug } = body
    return this.categoryService.model.create({ name, slug: slug ?? name })
  }

  @Put('/:id')
  @Auth()
  async modify(@Param() params: MongoIdDto, @Body() body: CategoryModel) {
    const { type, slug, name } = body
    const { id } = params
    await this.categoryService.model.updateOne(
      { _id: id },
      {
        slug,
        type,
        name,
      },
    )
    return await this.categoryService.model.findById(id)
  }

  @Patch('/:id')
  @HttpCode(204)
  @Auth()
  async patch(@Param() params: MongoIdDto, @Body() body: PartialCategoryModel) {
    const { id } = params
    await this.categoryService.model.updateOne({ _id: id }, body)
    return
  }

  @Delete('/:id')
  @Auth()
  async deleteCategory(@Param() params: MongoIdDto) {
    const { id } = params
    const category = await this.categoryService.model.findById(id)
    if (!category) {
      throw new NoContentCanBeModifiedException()
    }
    const postsInCategory = await this.categoryService.findPostsInCategory(
      category._id,
    )
    if (postsInCategory.length > 0) {
      throw new BadRequestException('该分类中有其他文章，无法被删除')
    }
    const res = await this.categoryService.model.deleteOne({
      _id: category._id,
    })
    if ((await this.categoryService.model.countDocuments({})) === 0) {
      await this.categoryService.createDefaultCategory()
    }
    return res
  }
}
