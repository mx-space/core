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
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { POST_SERVICE_TOKEN } from '~/constants/injection.constant'
import { TranslationEntryService } from '~/modules/ai/ai-translation/translation-entry.service'
import {
  applyArticleTranslationInPlace,
  applyTranslationEntriesInPlace,
  type EntryMaps,
  type EntryRule,
  TranslationService,
} from '~/processors/helper/helper.translation.service'
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

const CATEGORY_NAME_RULES: ReadonlyArray<EntryRule> = [
  { path: 'name', keyPath: 'category.name', mode: 'entity', idField: 'id' },
]

@ApiController({ path: 'categories' })
export class CategoryController {
  constructor(
    private readonly categoryService: CategoryService,
    @Inject(POST_SERVICE_TOKEN)
    private readonly postService: PostService,
    private readonly translationService: TranslationService,
    private readonly translationEntryService: TranslationEntryService,
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
      const idsMetaMap = new Map<string, any>()

      const allPosts: { categoryId: string; post: any }[] = []

      const categoryObjects: Array<{ id: string; cat: any }> = []

      const categoriesPromise = joint
        ? null
        : this.categoryService.repository.findByIds(ids)

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
          for (const post of posts) allPosts.push({ categoryId: id, post })
        }),
      )

      const categoriesById = await categoriesPromise

      if (categoriesById) {
        const catMap = new Map(categoriesById.map((c) => [String(c.id), c]))
        for (const id of ids) {
          categoryObjects.push({ id, cat: catMap.get(id) ?? null })
        }
      }

      if (lang) {
        const articles = allPosts.map(({ post }) => ({
          id: String(post.id),
          title: post.title ?? '',
          text: '',
          createdAt: post.createdAt,
          modifiedAt: post.modifiedAt ?? null,
        }))

        const [{ results, meta: titleMeta }, entryMaps] = await Promise.all([
          articles.length
            ? this.translationService.collectArticleTranslations({
                articles,
                targetLang: lang,
                fields: ['title'],
              })
            : Promise.resolve({
                results: new Map<string, any>(),
                meta: new Map<string, any>(),
              }),
          !joint && categoryObjects.length
            ? this.translationEntryService.getTranslationsBatch(lang, {
                entityLookups: [
                  {
                    keyPath: 'category.name',
                    lookupKeys: new Set(categoryObjects.map((c) => c.id)),
                  },
                ],
              })
            : Promise.resolve<EntryMaps>({
                entityMaps: new Map(),
                dictMaps: new Map(),
              }),
        ])

        for (const { post } of allPosts) {
          const tr = results.get(String(post.id))
          if (tr?.isTranslated) {
            applyArticleTranslationInPlace(post, tr as any, {
              fields: ['title'],
            })
          }
        }

        for (const [id, entry] of titleMeta) {
          idsMetaMap.set(id, entry)
        }

        for (const { cat } of categoryObjects) {
          applyTranslationEntriesInPlace(cat, entryMaps, CATEGORY_NAME_RULES)
        }
      }

      for (const id of ids) {
        const postsForId = allPosts
          .filter((p) => p.categoryId === id)
          .map((p) => p.post)
        if (joint) {
          map[id] = postsForId
        } else {
          const catObj = categoryObjects.find((c) => c.id === id)?.cat
          map[id] = { ...catObj, children: postsForId }
        }
      }

      const idsMetaBuilder = new MetaObjectBuilder()
      if (idsMetaMap.size > 0) {
        idsMetaBuilder.translation(idsMetaMap)
      }

      return withMeta({ entries: map }, idsMetaBuilder.build())
    }

    const result =
      type === CategoryType.Category
        ? await this.categoryService.findAllCategory()
        : await this.categoryService.getPostTagsSum()

    if (lang && Array.isArray(result) && result.length) {
      const entryMaps = await this.translationEntryService.getTranslationsBatch(
        lang,
        {
          entityLookups: [
            {
              keyPath: 'category.name',
              lookupKeys: new Set(result.map((cat: any) => String(cat.id))),
            },
          ],
        },
      )
      for (const cat of result as any[]) {
        applyTranslationEntriesInPlace(cat, entryMaps, CATEGORY_NAME_RULES)
      }
    }

    return withMeta(result, new MetaObjectBuilder().view('card').build())
  }

  @Get('/:query')
  async getCategoryById(
    @Param() { query }: SlugOrIdDto,
    @Query() { tag }: MultiQueryTagAndCategoryDto,
    @Lang() lang?: string,
  ) {
    if (!query) {
      throw createAppException(AppErrorCode.INVALID_PARAMETER, {
        message: 'Query is required',
      })
    }
    if (tag === true) {
      const data = await this.categoryService.findArticleWithTag(query)
      const tagMetaBuilder = new MetaObjectBuilder()
      if (lang && data?.length) {
        const articles = data.map((post: any) => ({
          id: String(post.id),
          title: post.title ?? '',
          text: '',
          createdAt: post.createdAt,
          modifiedAt: post.modifiedAt ?? null,
        }))
        const { results, meta: titleMeta } =
          await this.translationService.collectArticleTranslations({
            articles,
            targetLang: lang,
            fields: ['title'],
          })
        for (const post of data as any[]) {
          const tr = results.get(String(post.id))
          if (tr?.isTranslated) {
            applyArticleTranslationInPlace(post, tr as any, {
              fields: ['title'],
            })
          }
        }
        if (titleMeta.size > 0) tagMetaBuilder.translation(titleMeta)
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

    if (lang) {
      const articles = children.map((post: any) => ({
        id: String(post.id),
        title: post.title ?? '',
        text: '',
        createdAt: post.createdAt,
        modifiedAt: post.modifiedAt ?? null,
      }))

      const [entryMaps, { results, meta: titleMeta }] = await Promise.all([
        this.translationEntryService.getTranslationsBatch(lang, {
          entityLookups: [
            {
              keyPath: 'category.name',
              lookupKeys: new Set([String(res.id)]),
            },
          ],
        }),
        articles.length
          ? this.translationService.collectArticleTranslations({
              articles,
              targetLang: lang,
              fields: ['title'],
            })
          : Promise.resolve({
              results: new Map<string, any>(),
              meta: new Map<string, any>(),
            }),
      ])

      applyTranslationEntriesInPlace(res as any, entryMaps, CATEGORY_NAME_RULES)

      for (const post of children) {
        const tr = results.get(String(post.id))
        if (tr?.isTranslated) {
          applyArticleTranslationInPlace(post, tr as any, { fields: ['title'] })
        }
      }

      if (titleMeta.size > 0) metaBuilder.translation(titleMeta)
    }

    return withMeta({ ...res, count, children, tagsSum }, metaBuilder.build())
  }

  @Post('/')
  @Auth()
  @HTTPDecorators.Idempotence()
  create(@Body() body: CategoryDto) {
    const { name, slug } = body
    return this.categoryService.create(name, slug!)
  }

  @Put('/:id')
  @Auth()
  async modify(@Param() params: EntityIdDto, @Body() body: CategoryDto) {
    const { type, slug, name } = body
    const { id } = params
    await this.categoryService.update(id, { slug, type, name })
    return this.categoryService.findById(id)
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
  deleteCategory(@Param() params: EntityIdDto) {
    return this.categoryService.deleteById(params.id)
  }
}
