import { Injectable, OnApplicationBootstrap } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { omit } from 'es-toolkit/compat'

import { BizException } from '~/common/exceptions/biz.exception'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { NoContentCanBeModifiedException } from '~/common/exceptions/no-content-canbe-modified.exception'
import { ArticleTypeEnum } from '~/constants/article.constant'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { EventBusEvents } from '~/constants/event-bus.constant'
import { POST_SERVICE_TOKEN } from '~/constants/injection.constant'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { scheduleManager } from '~/utils/schedule.util'

import type { PostService } from '../post/post.service'
import { SlugTrackerService } from '../slug-tracker/slug-tracker.service'
import { CategoryType } from './category.enum'
import {
  type CategoryPatchInput,
  CategoryRepository,
  type CategoryRow,
  type CategoryWithCount,
} from './category.repository'

type TagDetailMapped = {
  _id: string
  title: string
  slug: string
  category: Record<string, unknown>
  created?: Date
  modified?: Date | null
  summary?: string | null
  tags?: string[]
  pin?: Date | null
  count?: { read?: number; like?: number }
}

@Injectable()
export class CategoryService implements OnApplicationBootstrap {
  private postService: PostService

  constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly eventManager: EventManagerService,
    private readonly slugTrackerService: SlugTrackerService,
    private readonly moduleRef: ModuleRef,
  ) {
    void this.createDefaultCategory()
  }

  onApplicationBootstrap() {
    this.postService = this.moduleRef.get(POST_SERVICE_TOKEN, { strict: false })
  }

  public get repository() {
    return this.categoryRepository
  }

  toLegacy(row: (CategoryRow | CategoryWithCount) | null): any {
    if (!row) return null
    return {
      ...row,
      _id: row.id,
      created: row.createdAt,
      modified: null,
    }
  }

  toLegacyMany(rows: Array<CategoryRow | CategoryWithCount>) {
    return rows.map((row) => this.toLegacy(row))
  }

  async findCategoryById(categoryId: string) {
    return this.toLegacy(await this.categoryRepository.findById(categoryId))
  }

  async findById(categoryId: string) {
    return this.findCategoryById(categoryId)
  }

  async findBySlug(slug: string) {
    return this.toLegacy(await this.categoryRepository.findBySlug(slug))
  }

  async findAllCategory() {
    return this.toLegacyMany(
      await this.categoryRepository.findAll(CategoryType.Category),
    )
  }

  async getPostTagsSum() {
    return this.postService.aggregateAllTagCounts()
  }

  async getCategoryTagsSum(categoryId: string) {
    return this.postService.aggregateTagCountsByCategory(categoryId)
  }

  async findArticleWithTag(
    tag: string,
    condition: { isPublished?: boolean } = {},
  ): Promise<TagDetailMapped[]> {
    const posts = await this.postService.findByTag(tag, {
      includeCategory: true,
    })
    const filtered = posts.filter((post) =>
      condition.isPublished === undefined
        ? true
        : post.isPublished === condition.isPublished,
    )
    if (filtered.length === 0) throw new CannotFindException()
    return filtered.map(
      ({
        _id,
        title,
        slug,
        category,
        created,
        modified,
        summary,
        tags,
        pin,
        count,
      }) => ({
        _id,
        title,
        slug,
        category: omit(category, ['count', '__v', 'created', 'modified']),
        created,
        modified,
        summary,
        tags,
        pin,
        count,
      }),
    )
  }

  async findCategoryPost(
    categoryId: string,
    condition: { isPublished?: boolean; tags?: string } = {},
  ) {
    const posts = await this.postService.listByCategory(categoryId, {
      includeCategory: false,
      publishedOnly: condition.isPublished,
    })
    return condition.tags
      ? posts.filter((post) => post.tags?.includes(condition.tags))
      : posts
  }

  async findPostsInCategory(id: string) {
    return this.postService.findByCategoryId(id)
  }

  async create(name: string, slug?: string) {
    const doc = this.toLegacy(
      await this.categoryRepository.create({ name, slug: slug ?? name }),
    )
    this.clearCache()
    this.eventManager.emit(BusinessEvents.CATEGORY_CREATE, doc, {
      scope: EventScope.TO_SYSTEM_VISITOR,
    })
    return doc
  }

  private async trackerSlugChanges(documentId: string, newSlug: string) {
    const category = await this.categoryRepository.findById(documentId)
    if (!category || category.slug === newSlug) return

    const originalSlug = `/${category.slug}`
    const posts = await this.postService.findByCategoryId(documentId)

    for (const post of posts) {
      await this.slugTrackerService.createTracker(
        `${originalSlug}/${post.slug}`,
        ArticleTypeEnum.Post,
        post.id,
      )
    }
  }

  async update(id: string, partialDoc: CategoryPatchInput) {
    if (partialDoc?.slug) await this.trackerSlugChanges(id, partialDoc.slug)
    const newDoc = this.toLegacy(
      await this.categoryRepository.update(id, partialDoc),
    )
    this.clearCache()
    this.eventManager.emit(BusinessEvents.CATEGORY_UPDATE, newDoc, {
      scope: EventScope.TO_SYSTEM_VISITOR,
    })
    return newDoc
  }

  async deleteById(id: string) {
    const category = await this.categoryRepository.findById(id)
    if (!category) throw new NoContentCanBeModifiedException()

    const postsInCategory = await this.findPostsInCategory(category.id)
    if (postsInCategory.length > 0) {
      throw new BizException(ErrorCodeEnum.CategoryHasPosts)
    }
    const deleted = await this.categoryRepository.deleteById(category.id)
    if ((await this.categoryRepository.countAll()) === 0) {
      await this.createDefaultCategory()
    }
    this.clearCache()
    this.eventManager.emit(
      BusinessEvents.CATEGORY_DELETE,
      { id },
      { scope: EventScope.TO_SYSTEM_VISITOR },
    )
    return { deletedCount: deleted ? 1 : 0 }
  }

  private clearCache() {
    return scheduleManager.batch(() =>
      this.eventManager.emit(EventBusEvents.CleanAggregateCache, null, {
        scope: EventScope.TO_SYSTEM,
      }),
    )
  }

  async createDefaultCategory() {
    if ((await this.categoryRepository.countAll()) === 0) {
      return this.toLegacy(
        await this.categoryRepository.create({
          name: '默认分类',
          slug: 'default',
        }),
      )
    }
  }
}
