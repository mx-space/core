import { isDefined } from 'class-validator'
import { debounce, omit } from 'lodash'
import slugify from 'slugify'
import type { DocumentType } from '@typegoose/typegoose'
import type { AggregatePaginateModel, Document, Types } from 'mongoose'

import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'

import { BusinessException } from '~/common/exceptions/biz.exception'
import { ArticleTypeEnum } from '~/constants/article.constant'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { CollectionRefTypes } from '~/constants/db.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { EventBusEvents } from '~/constants/event-bus.constant'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { ImageService } from '~/processors/helper/helper.image.service'
import { TextMacroService } from '~/processors/helper/helper.macro.service'
import { InjectModel } from '~/transformers/model.transformer'
import { scheduleManager } from '~/utils/schedule.util'
import { getLessThanNow } from '~/utils/time.util'

import { getArticleIdFromRoomName } from '../activity/activity.util'
import { CategoryService } from '../category/category.service'
import { CommentModel } from '../comment/comment.model'
import { SlugTrackerService } from '../slug-tracker/slug-tracker.service'
import { PostModel } from './post.model'

@Injectable()
export class PostService {
  constructor(
    @InjectModel(PostModel)
    private readonly postModel: MongooseModel<PostModel> &
      AggregatePaginateModel<PostModel & Document>,
    @InjectModel(CommentModel)
    private readonly commentModel: MongooseModel<CommentModel>,

    @Inject(forwardRef(() => CategoryService))
    private categoryService: CategoryService,
    private readonly imageService: ImageService,
    private readonly eventManager: EventManagerService,
    private readonly textMacroService: TextMacroService,

    private readonly slugTrackerService: SlugTrackerService,
  ) {}

  get model() {
    return this.postModel
  }

  async create(post: PostModel) {
    const { categoryId } = post

    const category = await this.categoryService.findCategoryById(
      categoryId as any as string,
    )
    if (!category) {
      throw new BadRequestException('分类丢失了 ಠ_ಠ')
    }

    const slug = post.slug ? slugify(post.slug) : slugify(post.title)
    if (!(await this.isAvailableSlug(slug))) {
      throw new BusinessException(ErrorCodeEnum.SlugNotAvailable)
    }

    // 有关联文章

    const relatedIds = await this.checkRelated(post)
    post.related = relatedIds as any

    const newPost = await this.postModel.create({
      ...post,
      slug,
      categoryId: category.id,
      created: getLessThanNow(post.created),
      modified: null,
    })

    const doc = newPost.toJSON()
    const cloned = { ...doc }

    // 双向关联
    await this.relatedEachOther(doc, relatedIds)

    scheduleManager.schedule(async () => {
      const doc = cloned
      await Promise.all([
        this.imageService.saveImageDimensionsFromMarkdownText(
          doc.text,
          doc.images,
          (images) => {
            newPost.images = images
            return newPost.save()
          },
        ),
        this.eventManager.emit(EventBusEvents.CleanAggregateCache, null, {
          scope: EventScope.TO_SYSTEM,
        }),
        this.eventManager.broadcast(
          BusinessEvents.POST_CREATE,
          {
            ...doc,
            category,
          },
          {
            scope: EventScope.TO_SYSTEM,
          },
        ),
        this.eventManager.broadcast(
          BusinessEvents.POST_CREATE,
          {
            ...doc,
            category,
            text: await this.textMacroService.replaceTextMacro(doc.text, doc),
          },
          {
            scope: EventScope.TO_VISITOR,
          },
        ),
      ])
    })

    return doc
  }

  private async trackSlugChanges(
    oldDocument: PostModel,
    newDocument: Partial<PostModel>,
  ) {
    const createTracker = this.slugTrackerService.createTracker.bind(
      this.slugTrackerService,
    )

    const oldDocumentRefCategory = await this.categoryService.findCategoryById(
      oldDocument.categoryId.toString(),
    )
    if (!oldDocumentRefCategory) {
      throw new BadRequestException('分类丢失了 ಠ_ಠ')
    }
    const oldSlugMeta = {
      slug: oldDocument.slug,
      categorySlug: oldDocumentRefCategory.slug,
    }

    if (newDocument.slug && oldSlugMeta.slug !== newDocument.slug) {
      return trackSlugChanges()
    }
    if (
      newDocument.categoryId &&
      oldDocument.categoryId !== newDocument.categoryId
    ) {
      return trackSlugChanges()
    }

    function trackSlugChanges() {
      return createTracker(
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
    const slugTrackerService = this.slugTrackerService
    const postModel = this.postModel

    const categoryDocument = await this.getCategoryBySlug(categorySlug)
    if (!categoryDocument) {
      const trackedPost = await findTrackedPost()
      if (!trackedPost) {
        throw new NotFoundException('该分类未找到 (｡•́︿•̀｡)')
      }

      // 检查发布状态
      if (!isAuthenticated && !trackedPost.isPublished) {
        throw new NotFoundException('该文章未找到')
      }

      return trackedPost
    }

    const queryConditions: any = {
      slug,
      categoryId: categoryDocument._id,
    }

    // 非认证用户只能查看已发布的文章
    if (!isAuthenticated) {
      queryConditions.isPublished = true
    }

    const postDocument = await this.model
      .findOne(queryConditions)
      .populate('category')
      .populate({
        path: 'related',
        select: 'title slug id _id categoryId category',
      })

    if (postDocument) return postDocument

    const trackedPost = await findTrackedPost()

    // 检查追踪文章的发布状态
    if (trackedPost && !isAuthenticated && !trackedPost.isPublished) {
      throw new NotFoundException('该文章未找到')
    }

    return trackedPost

    async function findTrackedPost() {
      const tracked = await slugTrackerService.findTrackerBySlug(
        `/${categorySlug}/${slug}`,
        ArticleTypeEnum.Post,
      )

      if (tracked) {
        return postModel
          .findById(tracked.targetId)
          .populate('category')
          .populate({
            path: 'related',
            select: 'title slug id _id categoryId category',
          })
      }
    }
  }

  async updateById(id: string, data: Partial<PostModel>) {
    const oldDocument = await this.postModel.findById(id)
    if (!oldDocument) {
      throw new BadRequestException('文章不存在')
    }
    // 看看 category 改了没
    const { categoryId } = data
    if (categoryId && categoryId !== oldDocument.categoryId) {
      const category = await this.categoryService.findCategoryById(
        categoryId as any as string,
      )
      if (!category) {
        throw new BadRequestException('分类不存在')
      }
    }
    // 只有修改了 text title slug 的值才触发更新 modified 的时间
    if ([data.text, data.title, data.slug].some((i) => isDefined(i))) {
      const now = new Date()

      data.modified = now
    }

    if (data.slug && data.slug !== oldDocument.slug) {
      data.slug = slugify(data.slug)
      const isAvailableSlug = await this.isAvailableSlug(data.slug)

      if (!isAvailableSlug) {
        throw new BusinessException(ErrorCodeEnum.SlugNotAvailable)
      }
    }

    await this.trackSlugChanges(oldDocument, data)

    // 有关联文章
    const related = await this.checkRelated(data)
    if (related.length > 0) {
      data.related = related.filter((id) => id !== oldDocument.id) as any

      // 双向关联
      await this.relatedEachOther(oldDocument, related)
    } else {
      await this.removeRelatedEachOther(oldDocument)
      oldDocument.related = []
    }

    Object.assign(
      oldDocument,
      omit(data, PostModel.protectedKeys),
      data.created
        ? {
            created: getLessThanNow(data.created),
          }
        : {},
    )

    await oldDocument.save()
    scheduleManager.schedule(() => this.afterUpdatePost(id, data, oldDocument))

    return oldDocument.toObject()
  }

  afterUpdatePost = debounce(
    async (
      id: string,
      updatedData: Partial<PostModel>,
      oldDocument: DocumentType<PostModel>,
    ) => {
      const doc = await this.postModel
        .findById(id)
        .populate('related', 'title slug category categoryId id _id')
        .lean({ getters: true, autopopulate: true })
      // 更新图片信息缓存
      await Promise.all([
        this.eventManager.emit(EventBusEvents.CleanAggregateCache, null, {
          scope: EventScope.TO_SYSTEM,
        }),
        updatedData.text &&
          this.imageService.saveImageDimensionsFromMarkdownText(
            updatedData.text,
            doc?.images,
            (images) => {
              oldDocument.images = images
              return oldDocument.save()
            },
          ),
        doc &&
          this.eventManager.broadcast(
            BusinessEvents.POST_UPDATE,
            {
              ...doc,
              text: await this.textMacroService.replaceTextMacro(doc.text, doc),
            },
            {
              scope: EventScope.TO_VISITOR,
              // gateway: {
              //   rooms: [getArticleIdFromRoomName(doc.id)],
              // },
            },
          ),
        doc &&
          this.eventManager.broadcast(BusinessEvents.POST_UPDATE, doc, {
            scope: EventScope.TO_SYSTEM,
          }),
      ])
    },
    1000,
    {
      leading: false,
    },
  )

  async deletePost(id: string) {
    const deletedPost = await this.postModel.findById(id).lean()
    await Promise.all([
      this.model.deleteOne({ _id: id }),
      this.commentModel.deleteMany({
        ref: id,
        refType: CollectionRefTypes.Post,
      }),
      this.removeRelatedEachOther(deletedPost),
      this.slugTrackerService.deleteAllTracker(id),
    ])
    await this.eventManager.broadcast(BusinessEvents.POST_DELETE, id, {
      scope: EventScope.TO_SYSTEM_VISITOR,
      nextTick: true,
      gateway: {
        rooms: [getArticleIdFromRoomName(id)],
      },
    })
  }

  async getCategoryBySlug(slug: string) {
    return await this.categoryService.model.findOne({ slug })
  }

  async isAvailableSlug(slug: string) {
    return (
      slug.length > 0 && (await this.postModel.countDocuments({ slug })) === 0
    )
  }

  async checkRelated<
    T extends Partial<Pick<PostModel, 'id' | 'related' | 'relatedId'>>,
  >(data: T): Promise<string[]> {
    const cloned = { ...data }

    // 有关联文章
    if (cloned.relatedId && cloned.relatedId.length > 0) {
      const relatedPosts = await this.postModel.find({
        _id: { $in: cloned.relatedId },
      })
      if (relatedPosts.length !== cloned.relatedId.length) {
        throw new BadRequestException('关联文章不存在')
      } else {
        return relatedPosts.map((i) => {
          if (i.related && (i.related as string[]).includes(data.id!)) {
            throw new BadRequestException('文章不能关联自己')
          }
          return i.id
        })
      }
    }
    return []
  }

  async relatedEachOther(post: PostModel, relatedIds: string[]) {
    if (relatedIds.length === 0) return
    const relatedPosts = await this.postModel.find({
      _id: { $in: relatedIds },
    })

    const postId = post.id
    await Promise.all(
      relatedPosts.map((i) => {
        i.related ||= []

        const set = new Set(i.related.map((i) => i.toString()) as string[])
        set.add(postId.toString())
        ;(i.related as string[]) = Array.from(set)

        return i.save()
      }),
    )
  }

  async removeRelatedEachOther(post: PostModel | null) {
    if (!post) return
    const postRelatedIds = (post.related as string[]) || []
    if (postRelatedIds.length === 0) {
      return
    }
    const relatedPosts = await this.postModel.find({
      _id: { $in: postRelatedIds },
    })
    const postId = post.id
    await Promise.all(
      relatedPosts.map((i) => {
        i.related = (i.related as any as Types.ObjectId[]).filter(
          (id) => id && id.toHexString() !== postId,
        ) as any
        return i.save()
      }),
    )
  }
}
