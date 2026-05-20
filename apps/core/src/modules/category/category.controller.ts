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
import { AppErrorCode, createAppException } from '~/common/errors'
import { withMeta } from '~/common/response/envelope.types'
import type { EntryTranslation } from '~/common/response/meta.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { ResponseV2 } from '~/common/response/v2-controller.decorator'
import { POST_SERVICE_TOKEN } from '~/constants/injection.constant'
import { TranslationService } from '~/processors/helper/helper.translation.service'
import { EntityIdDto } from '~/shared/dto/id.dto'

import type { PostService } from '../post/post.service'
import { CategoryType } from './category.enum'
import {
  CategoryDto,
  MultiCategoriesQueryDto,
  MultiQueryTagAndCategoryDto,
  PartialCategoryDto,
  SlugOrIdDto,
} from './category.schema'
import { CategoryService } from './category.service'

@ApiController({ path: 'categories' })
@ResponseV2()
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
    const { ids, joint, type = CategoryType.Category } = query
    if (ids) {
      const omitKeys = [
        'text',
        'summary',
        'isPublished',
        'images',
        'commentsIndex',
      ]
      const map: Record<string, any> = {}

      const idsTranslationMap = new Map<string, EntryTranslation>()
      await Promise.all(
        ids.map(async (id) => {
          const rawPosts = await this.postService.listByCategory(id, {
            includeCategory: false,
          })
          const posts: any[] = rawPosts.map((post) => {
            const cloned = { ...post }
            for (const field of omitKeys) delete cloned[field]
            return cloned
          })

          if (lang && posts.length) {
            await this.addPostTitleTranslations(idsTranslationMap, posts, lang)
          }

          if (joint) {
            map[id] = posts
          } else {
            const category = await this.categoryService.findCategoryById(id)
            map[id] = { ...category, children: posts }
          }
        }),
      )

      const idsMetaBuilder = new MetaObjectBuilder()
      if (idsTranslationMap.size > 0) {
        idsMetaBuilder.translation(idsTranslationMap)
      }

      return withMeta({ entries: map }, idsMetaBuilder.build())
    }

    const result =
      type === CategoryType.Category
        ? await this.categoryService.findAllCategory()
        : await this.categoryService.getPostTagsSum()

    const metaBuilder = new MetaObjectBuilder().view('card')
    const translationMap = new Map<string, EntryTranslation>()

    if (lang && Array.isArray(result) && result.length) {
      const names = await this.translationService.getEntityTranslations(
        'category.name',
        lang,
        result.map((cat: any) => String(cat.id)),
      )
      for (const cat of result as any[]) {
        const translated = names.get(String(cat.id))
        if (translated) {
          translationMap.set(String(cat.id), { fields: { name: translated } })
        }
      }
    }

    if (translationMap.size > 0) metaBuilder.translation(translationMap)

    return withMeta(result, metaBuilder.build())
  }

  @Get('/:query')
  async getCategoryById(
    @Param() { query }: SlugOrIdDto,
    @Query() { tag }: MultiQueryTagAndCategoryDto,
    @Lang() lang?: string,
  ) {
    if (!query) {
      throw createAppException(AppErrorCode.INVALID_PARAMETER, { message: 'Query is required' })
    }
    if (tag === true) {
      const data = await this.categoryService.findArticleWithTag(query)
      const tagMetaBuilder = new MetaObjectBuilder()
      if (lang && data?.length) {
        const tagTranslationMap = new Map<string, EntryTranslation>()
        await this.addPostTitleTranslations(tagTranslationMap, data, lang)
        if (tagTranslationMap.size > 0) {
          tagMetaBuilder.translation(tagTranslationMap)
        }
      }
      return withMeta({ tag: query, data }, tagMetaBuilder.build())
    }

    const isIdLike = /^\d+$/.test(query) || /^[\da-f]{24}$/i.test(query)
    const res = isIdLike
      ? await this.categoryService.findById(query)
      : await this.categoryService.findBySlug(query)

    if (!res) {
      throw createAppException(AppErrorCode.CATEGORY_NOT_FOUND, { id: query })
    }

    const [postsResult, tagsSum, count] = await Promise.all([
      this.categoryService.findCategoryPost(res.id, {
        tags: typeof tag === 'string' ? tag : undefined,
      }),
      this.categoryService.getCategoryTagsSum(res.id),
      this.postService.countByCategoryId(res.id),
    ])

    const children: any[] = postsResult ?? []

    const metaBuilder = new MetaObjectBuilder().view('detail')
    const translationMap = new Map<string, EntryTranslation>()
    if (lang && res) {
      const names = await this.translationService.getEntityTranslations(
        'category.name',
        lang,
        [String(res.id)],
      )
      const translatedName = names.get(String(res.id))
      if (translatedName) {
        translationMap.set(String(res.id), {
          fields: { name: translatedName },
        })
      }
    }
    if (lang && children.length) {
      await this.addPostTitleTranslations(translationMap, children, lang)
    }
    if (translationMap.size > 0) metaBuilder.translation(translationMap)

    return withMeta({ ...res, count, children, tagsSum }, metaBuilder.build())
  }

  private async addPostTitleTranslations(
    map: Map<string, EntryTranslation>,
    posts: any[],
    lang: string,
  ): Promise<void> {
    if (!posts.length) return

    const results = await this.translationService.translateArticleList({
      articles: posts.map((post) => ({
        id: String(post.id),
        title: post.title ?? '',
        text: '',
        createdAt: post.createdAt,
        modifiedAt: post.modifiedAt ?? null,
      })),
      targetLang: lang,
      translationFields: ['title'] as const,
    })

    for (const [id, translation] of results) {
      if (translation?.isTranslated) {
        map.set(id, {
          article: {
            is_translated: true,
            target_lang: lang,
            title: translation.title,
          },
        })
      }
    }
  }

  @Post('/')
  @Auth()
  @HTTPDecorators.Idempotence()
  async create(@Body() body: CategoryDto) {
    const { name, slug } = body
    const created = await this.categoryService.create(name, slug!)
    return created
  }

  @Put('/:id')
  @Auth()
  async modify(@Param() params: EntityIdDto, @Body() body: CategoryDto) {
    const { type, slug, name } = body
    const { id } = params
    await this.categoryService.update(id, { slug, type, name })
    const updated = await this.categoryService.findById(id)
    return updated
  }

  @Patch('/:id')
  @HttpCode(204)
  @Auth()
  async patch(@Param() params: EntityIdDto, @Body() body: PartialCategoryDto) {
    const { id } = params
    await this.categoryService.update(id, body)
  }

  @Delete('/:id')
  @Auth()
  async deleteCategory(@Param() params: EntityIdDto) {
    const { id } = params
    const result = await this.categoryService.deleteById(id)
    return result
  }
}
