import { Controller, forwardRef, Get, Inject, Query } from '@nestjs/common'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { PostService } from '../post/post.service'
import { CategoryType, MultiCategoriesQueryDto } from './category.dto'
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
  async getCategories(@Query() query: MultiCategoriesQueryDto) {
    const { ids, joint, type = CategoryType.Category } = query // categories is category's mongo id
    if (ids) {
      return joint
        ? await Promise.all(
            ids.map(async (id) => {
              return await this.postService.model.find(
                { categoryId: id },
                {
                  select: 'title slug _id categoryId created modified',
                  sort: { created: -1 },
                },
              )
            }),
          )
        : await Promise.all(
            ids.map(async (id) => {
              const posts = await this.postService.model.find(
                { categoryId: id },
                {
                  select: 'title slug _id created modified',
                  sort: { created: -1 },
                },
              )
              const category = await this.categoryService.model
                .findById(id)
                .lean()
              return {
                category: { ...category, children: posts },
              }
            }),
          )
    }
    return type === CategoryType.Category
      ? await this.categoryService.model.find({ type }).lean()
      : await this.categoryService.getPostTagsSum()
  }
}
