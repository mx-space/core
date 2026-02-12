import {
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
} from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { Lang } from '~/common/decorators/lang.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { POST_SERVICE_TOKEN } from '~/constants/injection.constant'
import { TranslationService } from '~/processors/helper/helper.translation.service'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { isValidObjectId } from 'mongoose'
import type { PostService } from '../post/post.service'
import { CategoryType } from './category.model'
import {
  CategoryDto,
  MultiCategoriesQueryDto,
  MultiQueryTagAndCategoryDto,
  PartialCategoryDto,
  SlugOrIdDto,
} from './category.schema'
import { CategoryService } from './category.service'

@ApiController({ path: 'categories' })
export class CategoryController {
  constructor(
    private readonly categoryService: CategoryService,
    @Inject(POST_SERVICE_TOKEN)
    private readonly postService: PostService,
    private readonly translationService: TranslationService,
  ) {}

  @Get('/')
  async getCategories(
    @Query() query: MultiCategoriesQueryDto,
    @Lang() lang?: string,
  ) {
    const { ids, joint, type = CategoryType.Category } = query // categories is category's mongo id
    if (ids) {
      const ignoreKeys = '-text -summary -isPublished -images -commentsIndex'
      const map: Record<string, any> = {}

      await Promise.all(
        ids.map(async (id) => {
          let posts: any[] = await this.postService.model
            .find({ categoryId: id }, ignoreKeys)
            .sort({ created: -1 })
            .lean()

          if (lang && posts.length) {
            posts = await this.translatePostTitles(posts, lang)
          }

          if (joint) {
            map[id] = posts
          } else {
            const category = await this.categoryService.findCategoryById(id)
            map[id] = { ...category, children: posts }
          }
        }),
      )

      return { entries: map }
    }
    return type === CategoryType.Category
      ? await this.categoryService.findAllCategory()
      : await this.categoryService.getPostTagsSum()
  }

  @Get('/:query')
  async getCategoryById(
    @Param() { query }: SlugOrIdDto,
    @Query() { tag }: MultiQueryTagAndCategoryDto,
    @Lang() lang?: string,
  ) {
    if (!query) {
      throw new BizException(ErrorCodeEnum.InvalidParameter)
    }
    if (tag === true) {
      let data = await this.categoryService.findArticleWithTag(query)
      if (lang && data?.length) {
        data = await this.translatePostTitles(data, lang)
      }
      return { tag: query, data }
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

    let children: any[] =
      (await this.categoryService.findCategoryPost(res._id.toHexString(), {
        $and: [tag ? { tags: tag } : {}],
      })) || []

    if (lang && children.length) {
      children = await this.translatePostTitles(children, lang)
    }

    return { data: { ...res, children } }
  }

  private translatePostTitles(posts: any[], lang: string) {
    return this.translationService.translateList({
      items: posts,
      targetLang: lang,
      translationFields: ['title', 'translationMeta'] as const,
      getInput: (item: any) => ({
        id: item._id?.toString?.() ?? item.id ?? '',
        title: item.title ?? '',
        created: item.created,
        modified: item.modified,
      }),
      applyResult: (item: any, translation) => {
        if (!translation?.isTranslated) return item
        const plain =
          typeof item.toObject === 'function' ? item.toObject() : item
        return {
          ...plain,
          title: translation.title,
          isTranslated: true,
          translationMeta: translation.translationMeta,
        }
      },
    })
  }

  @Post('/')
  @Auth()
  @HTTPDecorators.Idempotence()
  async create(@Body() body: CategoryDto) {
    const { name, slug } = body
    return this.categoryService.create(name, slug!)
  }

  @Put('/:id')
  @Auth()
  async modify(@Param() params: MongoIdDto, @Body() body: CategoryDto) {
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
  async patch(@Param() params: MongoIdDto, @Body() body: PartialCategoryDto) {
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
