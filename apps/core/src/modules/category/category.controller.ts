import { isValidObjectId } from 'mongoose'

import {
  BadRequestException,
  Body,
  Delete,
  forwardRef,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
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
      const ignoreKeys = '-text -summary -isPublished -images -commentsIndex'
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
      (await this.categoryService.findCategoryPost(res._id.toHexString(), {
        $and: [tag ? { tags: tag } : {}],
      })) || []
    return { data: { ...res, children } }
  }

  @Post('/')
  @Auth()
  @HTTPDecorators.Idempotence()
  async create(@Body() body: CategoryModel) {
    const { name, slug } = body
    return this.categoryService.create(name, slug)
  }

  @Put('/:id')
  @Auth()
  async modify(@Param() params: MongoIdDto, @Body() body: CategoryModel) {
    const { type, slug, name } = body
    const { id } = params
    await this.categoryService.update(id, {
      slug,
      type,
      name,
    })
    return await this.categoryService.model.findById(id)
  }

  @Patch('/:id')
  @HttpCode(204)
  @Auth()
  async patch(@Param() params: MongoIdDto, @Body() body: PartialCategoryModel) {
    const { id } = params
    await this.categoryService.update(id, body)
    return
  }

  @Delete('/:id')
  @Auth()
  async deleteCategory(@Param() params: MongoIdDto) {
    const { id } = params

    return await this.categoryService.deleteById(id)
  }
}
