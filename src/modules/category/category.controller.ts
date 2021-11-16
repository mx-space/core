import {
  BadRequestException,
  Body,
  Controller,
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
import { ApiQuery } from '@nestjs/swagger'
import { Types } from 'mongoose'
import { Auth } from '~/common/decorator/auth.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { IsMaster } from '~/common/decorator/role.decorator'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { addConditionToSeeHideContent } from '~/utils/query.util'
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

@Controller({ path: 'categories' })
@ApiName
export class CategoryController {
  constructor(
    private readonly categoryService: CategoryService,
    @Inject(forwardRef(() => PostService))
    private readonly postService: PostService,
  ) {}

  @Get('/')
  async getCategories(
    @Query() query: MultiCategoriesQueryDto,
    @IsMaster() isMaster: boolean,
  ) {
    const { ids, joint, type = CategoryType.Category } = query // categories is category's mongo id
    if (ids) {
      return joint
        ? await Promise.all(
            ids.map(async (id) => {
              return await this.postService.model
                .find(
                  { categoryId: id, ...addConditionToSeeHideContent(isMaster) },
                  'title slug _id categoryId created modified',
                )
                .sort({ created: -1 })
                .lean()
            }),
          )
        : await Promise.all(
            ids.map(async (id) => {
              const posts = await this.postService.model
                .find(
                  { categoryId: id, ...addConditionToSeeHideContent(isMaster) },
                  'title slug _id created modified',
                )
                .sort({ created: -1 })
                .lean()
              const category = await this.categoryService.findCategoryById(id)

              return {
                category: { ...category, children: posts },
              }
            }),
          )
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
    @IsMaster() isMaster: boolean,
  ) {
    if (!query) {
      throw new BadRequestException()
    }
    if (tag === true) {
      return {
        tag: query,
        data: await this.categoryService.findArticleWithTag(
          query,
          addConditionToSeeHideContent(isMaster),
        ),
      }
    }

    const isId = Types.ObjectId.isValid(query)
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
        $and: [
          tag ? { tags: tag } : {},
          addConditionToSeeHideContent(isMaster),
        ],
      })) || []
    return { data: { ...res, children } }
  }

  @Post('/')
  @Auth()
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
      throw new CannotFindException()
    }
    const postsInCategory = await this.categoryService.findPostsInCategory(
      category._id,
    )
    if (postsInCategory.length > 0) {
      throw new BadRequestException('该分类中有其他文章, 无法被删除')
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
