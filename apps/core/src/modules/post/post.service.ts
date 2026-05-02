import { Injectable, OnApplicationBootstrap } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { debounce, omit } from 'es-toolkit/compat'
import slugify from 'slugify'

import {
  BizException,
  BusinessException,
} from '~/common/exceptions/biz.exception'
import { ArticleTypeEnum } from '~/constants/article.constant'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { EventBusEvents } from '~/constants/event-bus.constant'
import {
  CATEGORY_SERVICE_TOKEN,
  DRAFT_SERVICE_TOKEN,
} from '~/constants/injection.constant'
import { FileReferenceType } from '~/modules/file/file-reference.enum'
import { FileReferenceService } from '~/modules/file/file-reference.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { ImageService } from '~/processors/helper/helper.image.service'
import { LexicalService } from '~/processors/helper/helper.lexical.service'
import { ContentFormat } from '~/shared/types/content-format.type'
import { isLexical } from '~/utils/content.util'
import { scheduleManager } from '~/utils/schedule.util'
import { getLessThanNow } from '~/utils/time.util'
import { isDefined } from '~/utils/validator.util'

import type { CategoryService } from '../category/category.service'
import { CommentService } from '../comment/comment.service'
import { DraftRefType } from '../draft/draft.enum'
import type { DraftService } from '../draft/draft.service'
import { SlugTrackerService } from '../slug-tracker/slug-tracker.service'
import {
  type PostListParams,
  PostRepository,
  type PostRow,
} from './post.repository'
import { POST_PROTECTED_KEYS, type PostModel } from './post.types'

@Injectable()
export class PostService implements OnApplicationBootstrap {
  private categoryService: CategoryService
  private draftService: DraftService

  constructor(
    private readonly postRepository: PostRepository,
    private readonly commentService: CommentService,
    private readonly imageService: ImageService,
    private readonly fileReferenceService: FileReferenceService,
    private readonly eventManager: EventManagerService,
    private readonly slugTrackerService: SlugTrackerService,
    private readonly lexicalService: LexicalService,
    private readonly moduleRef: ModuleRef,
  ) {}

  onApplicationBootstrap() {
    this.categoryService = this.moduleRef.get(CATEGORY_SERVICE_TOKEN, {
      strict: false,
    })
    this.draftService = this.moduleRef.get(DRAFT_SERVICE_TOKEN, {
      strict: false,
    })
  }

  public get repository() {
    return this.postRepository
  }

  private normalizeMeta(meta: unknown) {
    if (meta === undefined) return undefined
    if (meta === null) return null
    if (typeof meta === 'string') return JSON.safeParse(meta) ?? null
    return meta as Record<string, unknown>
  }

  toLegacy(row: PostRow | null): any {
    if (!row) return null
    const category = row.category
      ? {
          ...row.category,
          _id: row.category.id,
          created: undefined,
          modified: null,
        }
      : undefined
    const plain: any = {
      ...row,
      _id: row.id,
      created: row.createdAt,
      modified: row.modifiedAt,
      category,
      pin: row.pinAt,
      count: { read: row.readCount, like: row.likeCount },
      commentsIndex: 0,
      allowComment: true,
    }
    plain.toObject = () => ({ ...plain, toObject: undefined })
    return plain
  }

  toLegacyMany(rows: PostRow[]) {
    return rows.map((row) => this.toLegacy(row))
  }

  toPaginate(result: Awaited<ReturnType<PostRepository['list']>>) {
    return {
      docs: this.toLegacyMany(result.data),
      totalDocs: result.pagination.total,
      page: result.pagination.currentPage,
      totalPages: result.pagination.totalPage,
      limit: result.pagination.size,
      hasNextPage: result.pagination.hasNextPage,
      hasPrevPage: result.pagination.hasPrevPage,
    }
  }

  async list(params: PostListParams = {}) {
    return this.postRepository.list(params)
  }

  async listPaginated(params: PostListParams = {}) {
    return this.toPaginate(await this.postRepository.list(params))
  }

  async findById(id: string) {
    return this.toLegacy(await this.postRepository.findById(id))
  }

  async findBySlug(slug: string) {
    return this.toLegacy(await this.postRepository.findBySlug(slug))
  }

  async findByCategoryAndSlug(
    categoryId: string,
    slug: string,
    isAuthenticated?: boolean,
  ) {
    return this.toLegacy(
      await this.postRepository.findByCategoryAndSlug(categoryId, slug, {
        publishedOnly: !isAuthenticated,
      }),
    )
  }

  async findRecent(size: number, options: { publishedOnly?: boolean } = {}) {
    return this.toLegacyMany(
      await this.postRepository.findRecent(size, options),
    )
  }

  async findManyByIds(ids: string[]) {
    return this.toLegacyMany(await this.postRepository.findManyByIds(ids))
  }

  async count() {
    return this.postRepository.count()
  }

  async countByCategoryId(categoryId: string) {
    return this.postRepository.countByCategoryId(categoryId)
  }

  async listByCategory(
    categoryId: string,
    options: {
      includeCategory?: boolean
      limit?: number
      publishedOnly?: boolean
    } = {},
  ) {
    return this.toLegacyMany(
      await this.postRepository.listByCategory(categoryId, options),
    )
  }

  async findByCategoryId(categoryId: string) {
    return this.listByCategory(categoryId)
  }

  async findByTag(tag: string, options: { includeCategory?: boolean } = {}) {
    return this.toLegacyMany(await this.postRepository.findByTag(tag, options))
  }

  async aggregateAllTagCounts() {
    return this.postRepository.aggregateAllTagCounts()
  }

  async aggregateTagCountsByCategory(categoryId: string) {
    return this.postRepository.aggregateTagCountsByCategory(categoryId)
  }

  async findAdjacent(
    direction: 'before' | 'after',
    pivotDate: Date,
    options: { publishedOnly?: boolean } = {},
  ) {
    return this.toLegacy(
      await this.postRepository.findAdjacent(direction, pivotDate, options),
    )
  }

  async create(post: PostModel & { draftId?: string }) {
    this.lexicalService.populateText(post)

    const { categoryId, draftId } = post
    const category = await this.categoryService.findCategoryById(
      categoryId as any as string,
    )
    if (!category) {
      throw new BizException(ErrorCodeEnum.CategoryNotFound)
    }

    const slug = post.slug ? slugify(post.slug) : slugify(post.title)
    if (!(await this.isAvailableSlug(slug))) {
      throw new BusinessException(ErrorCodeEnum.SlugNotAvailable)
    }

    const relatedIds = await this.checkRelated(post)
    const createdAt = getLessThanNow(post.created)
    const created = await this.postRepository.create({
      title: post.title,
      slug,
      text: post.text,
      content: post.content,
      contentFormat: post.contentFormat ?? ContentFormat.Markdown,
      summary: post.summary,
      images: post.images as unknown[],
      meta: this.normalizeMeta(post.meta) as Record<string, unknown> | null,
      tags: post.tags,
      categoryId: category.id ?? category._id,
      copyright: post.copyright,
      isPublished: post.isPublished,
      pinAt: post.pin,
      pinOrder: post.pinOrder,
    })
    if (createdAt && createdAt.valueOf() !== created.createdAt.valueOf()) {
      await this.postRepository.update(created.id, { modifiedAt: null })
    }
    const doc = this.toLegacy(created)

    await this.relatedEachOther(doc, relatedIds)

    if (draftId) {
      await this.fileReferenceService.removeReferencesForDocument(
        draftId,
        FileReferenceType.Draft,
      )
      await this.draftService.linkToPublished(draftId, doc.id)
      await this.draftService.markAsPublished(draftId)
    }

    scheduleManager.schedule(async () => {
      await Promise.all([
        this.fileReferenceService.activateReferences(
          doc,
          doc.id,
          FileReferenceType.Post,
        ),
        !isLexical(doc) &&
          this.imageService.saveImageDimensionsFromMarkdownText(
            doc.text,
            doc.images,
            async (images) => {
              await this.postRepository.setImages(doc.id, images)
            },
          ),
        this.eventManager.emit(EventBusEvents.CleanAggregateCache, null, {
          scope: EventScope.TO_SYSTEM,
        }),
        this.eventManager.emit(
          BusinessEvents.POST_CREATE,
          { id: doc.id },
          { scope: EventScope.TO_SYSTEM_VISITOR },
        ),
      ])
    })

    return doc
  }

  private async trackSlugChanges(
    oldDocument: any,
    newDocument: Partial<PostModel>,
  ) {
    const oldDocumentRefCategory = await this.categoryService.findCategoryById(
      oldDocument.categoryId.toString(),
    )
    if (!oldDocumentRefCategory) {
      throw new BizException(ErrorCodeEnum.CategoryNotFound)
    }
    const oldSlugMeta = {
      slug: oldDocument.slug,
      categorySlug: oldDocumentRefCategory.slug,
    }

    if (newDocument.slug && oldSlugMeta.slug !== newDocument.slug) {
      return trackSlugChanges.call(this)
    }
    if (
      newDocument.categoryId &&
      String(oldDocument.categoryId) !== String(newDocument.categoryId)
    ) {
      return trackSlugChanges.call(this)
    }

    async function trackSlugChanges(this: PostService) {
      return this.slugTrackerService.createTracker(
        `/${oldSlugMeta.categorySlug}/${oldSlugMeta.slug}`,
        ArticleTypeEnum.Post,
        oldDocument.id,
      )
    }
  }

  async getPostBySlug(
    categorySlug: string,
    slug: string,
    isAuthenticated?: boolean,
  ) {
    const findTrackedPost = async () => {
      const tracked = await this.slugTrackerService.findTrackerBySlug(
        `/${categorySlug}/${slug}`,
        ArticleTypeEnum.Post,
      )
      return tracked ? this.findById(tracked.targetId) : null
    }

    const categoryDocument = await this.getCategoryBySlug(categorySlug)
    if (!categoryDocument) {
      const trackedPost = await findTrackedPost()
      if (!trackedPost) throw new BizException(ErrorCodeEnum.CategoryNotFound)
      if (!isAuthenticated && !trackedPost.isPublished) {
        throw new BizException(ErrorCodeEnum.PostNotFound)
      }
      return trackedPost
    }

    const postDocument = await this.findByCategoryAndSlug(
      categoryDocument.id ?? categoryDocument._id,
      slug,
      isAuthenticated,
    )
    if (postDocument) return postDocument

    const trackedPost = await findTrackedPost()
    if (trackedPost && !isAuthenticated && !trackedPost.isPublished) {
      throw new BizException(ErrorCodeEnum.PostNotFound)
    }
    return trackedPost
  }

  async updateById(
    id: string,
    data: Partial<PostModel> & { draftId?: string },
  ) {
    this.lexicalService.populateText(data as any)

    const oldDocument = await this.findById(id)
    if (!oldDocument) {
      throw new BizException(ErrorCodeEnum.PostNotFound)
    }

    const { draftId } = data
    const { categoryId } = data
    if (categoryId && String(categoryId) !== String(oldDocument.categoryId)) {
      const category = await this.categoryService.findCategoryById(
        categoryId as any as string,
      )
      if (!category) throw new BizException(ErrorCodeEnum.CategoryNotFound)
    }

    if ([data.text, data.title, data.slug].some((i) => isDefined(i))) {
      data.modified = new Date()
    }

    if (data.slug && data.slug !== oldDocument.slug) {
      data.slug = slugify(data.slug)
      if (!(await this.isAvailableSlug(data.slug))) {
        throw new BusinessException(ErrorCodeEnum.SlugNotAvailable)
      }
    }

    await this.trackSlugChanges(oldDocument, data)

    const related = await this.checkRelated(data)
    if (related.length > 0) {
      await this.relatedEachOther(
        oldDocument,
        related.filter((rel) => rel !== id),
      )
    } else {
      await this.removeRelatedEachOther(oldDocument)
    }

    const patch = omit(data, POST_PROTECTED_KEYS as any) as Partial<PostModel>
    const updated = await this.postRepository.update(id, {
      title: patch.title,
      slug: patch.slug,
      text: patch.text,
      content: patch.content,
      contentFormat: patch.contentFormat,
      summary: patch.summary,
      images: patch.images as unknown[] | undefined,
      meta:
        patch.meta !== undefined
          ? (this.normalizeMeta(patch.meta) as Record<string, unknown> | null)
          : undefined,
      tags: patch.tags,
      categoryId: patch.categoryId as string | undefined,
      copyright: patch.copyright,
      isPublished: patch.isPublished,
      pinAt: patch.pin,
      pinOrder: patch.pinOrder,
      modifiedAt: data.modified,
    })

    if (draftId) {
      await this.draftService.markAsPublished(draftId)
    }

    scheduleManager.schedule(() => this.afterUpdatePost(id))
    return this.toLegacy(updated)
  }

  afterUpdatePost = debounce(
    async (id: string) => {
      const doc = await this.findById(id)
      if (doc) {
        await this.fileReferenceService.updateReferencesForDocument(
          doc,
          doc.id,
          FileReferenceType.Post,
        )
      }

      await Promise.all([
        this.eventManager.emit(EventBusEvents.CleanAggregateCache, null, {
          scope: EventScope.TO_SYSTEM,
        }),
        doc?.text &&
          !isLexical(doc) &&
          this.imageService.saveImageDimensionsFromMarkdownText(
            doc.text,
            doc.images,
            async (images) => {
              await this.postRepository.setImages(id, images)
            },
          ),
        doc &&
          this.eventManager.emit(
            BusinessEvents.POST_UPDATE,
            { id: doc.id },
            { scope: EventScope.TO_SYSTEM_VISITOR },
          ),
      ])
    },
    1000,
    { leading: false },
  )

  async deletePost(id: string) {
    const deletedPost = await this.findById(id)
    await Promise.all([
      this.postRepository.deleteById(id),
      this.commentService.deleteForRef(CollectionRefTypes.Post, id),
      this.draftService.deleteByRef(DraftRefType.Post, id),
      this.removeRelatedEachOther(deletedPost),
      this.slugTrackerService.deleteAllTracker(id),
      this.fileReferenceService.removeReferencesForDocument(
        id,
        FileReferenceType.Post,
      ),
    ])
    await this.eventManager.emit(
      BusinessEvents.POST_DELETE,
      { id },
      {
        scope: EventScope.TO_SYSTEM_VISITOR,
        nextTick: true,
      },
    )
  }

  async getCategoryBySlug(slug: string) {
    return this.categoryService.findBySlug(slug)
  }

  async isAvailableSlug(slug: string) {
    return slug.length > 0 && !(await this.postRepository.findBySlug(slug))
  }

  async checkRelated<
    T extends Partial<Pick<PostModel, 'id' | 'related' | 'relatedId'>>,
  >(data: T): Promise<string[]> {
    if (!data.relatedId || data.relatedId.length === 0) return []

    const relatedPosts = await this.postRepository.findManyByIds(data.relatedId)
    if (relatedPosts.length !== data.relatedId.length) {
      throw new BizException(ErrorCodeEnum.PostRelatedNotExists)
    }

    return relatedPosts.map((post) => {
      if (post.id === data.id) {
        throw new BizException(ErrorCodeEnum.PostSelfRelation)
      }
      return post.id
    })
  }

  async relatedEachOther(post: any, relatedIds: string[]) {
    await this.postRepository.setRelatedPosts(post.id, relatedIds)
  }

  async removeRelatedEachOther(post: any | null) {
    if (!post) return
    await this.postRepository.setRelatedPosts(post.id, [])
  }
}
