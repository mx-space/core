import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
} from '@nestjs/common'
import type { DocumentType } from '@typegoose/typegoose'
import { ReturnModelType } from '@typegoose/typegoose'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { NoContentCanBeModifiedException } from '~/common/exceptions/no-content-canbe-modified.exception'
import { ArticleTypeEnum } from '~/constants/article.constant'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { EventBusEvents } from '~/constants/event-bus.constant'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { InjectModel } from '~/transformers/model.transformer'
import { scheduleManager } from '~/utils/schedule.util'
import { omit } from 'lodash'
import type { FilterQuery } from 'mongoose'
import type { PostModel } from '../post/post.model'
import { PostService } from '../post/post.service'
import { SlugTrackerService } from '../slug-tracker/slug-tracker.service'
import { CategoryModel, CategoryType } from './category.model'

@Injectable()
export class CategoryService {
  constructor(
    @InjectModel(CategoryModel)
    private readonly categoryModel: ReturnModelType<typeof CategoryModel>,
    @Inject(forwardRef(() => PostService))
    private readonly postService: PostService,
    private readonly eventManager: EventManagerService,

    private readonly slugTrackerService: SlugTrackerService,
  ) {
    this.createDefaultCategory()
  }

  async findCategoryById(categoryId: string) {
    const [category, count] = await Promise.all([
      this.model.findById(categoryId).lean(),
      this.postService.model.countDocuments({ categoryId }),
    ])
    return {
      ...category,
      count,
    }
  }

  async findAllCategory() {
    const data = await this.model.find({ type: CategoryType.Category }).lean()
    const counts = await Promise.all(
      data.map((item) => {
        const id = item._id
        return this.postService.model.countDocuments({ categoryId: id })
      }),
    )

    for (const [i, datum] of data.entries()) {
      Reflect.set(datum, 'count', counts[i])
    }

    return data
  }

  get model() {
    return this.categoryModel
  }

  async getPostTagsSum() {
    const data = await this.postService.model.aggregate([
      { $project: { tags: 1 } },
      {
        $unwind: '$tags',
      },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      {
        $project: {
          _id: 0,
          name: '$_id',
          count: 1,
        },
      },
    ])
    return data
  }

  async findArticleWithTag(
    tag: string,
    condition: FilterQuery<DocumentType<PostModel>> = {},
  ): Promise<null | any[]> {
    const posts = await this.postService.model
      .find(
        {
          tags: tag,
          ...condition,
        },
        undefined,
        { lean: true },
      )
      .populate('category')
    if (posts.length === 0) {
      throw new CannotFindException()
    }
    return posts.map(({ _id, title, slug, category, created }) => ({
      _id,
      title,
      slug,
      category: omit(category, ['count', '__v', 'created', 'modified']),
      created,
    }))
  }

  async findCategoryPost(categoryId: string, condition: any = {}) {
    return await this.postService.model
      .find({
        categoryId,
        ...condition,
      })
      .select('title created slug _id')
      .sort({ created: -1 })
  }

  async findPostsInCategory(id: string) {
    return await this.postService.model.find({
      categoryId: id,
    })
  }

  async create(name: string, slug?: string) {
    const doc = await this.model.create({ name, slug: slug ?? name })
    this.clearCache()
    this.eventManager.broadcast(BusinessEvents.CATEGORY_CREATE, doc, {
      scope: EventScope.TO_SYSTEM_VISITOR,
    })
    return doc
  }

  private async trackerSlugChanges(documentId: string, newSlug: string) {
    const category = await this.model.findById(documentId).select('slug')
    if (!category) return
    if (category.slug === newSlug) return

    const originalSlug = `/${category.slug}`

    const allPostReferenceThisCategory = await this.postService.model.find({
      categoryId: documentId,
    })

    const needTrackerMetaList = [] as [string, string][]
    for (const post of allPostReferenceThisCategory) {
      needTrackerMetaList.push([post.slug, post.id])
    }

    for (const postSlugMeta of needTrackerMetaList) {
      const [postSlug, postId] = postSlugMeta
      await this.slugTrackerService.createTracker(
        `${originalSlug}/${postSlug}`,
        ArticleTypeEnum.Post,
        postId,
      )
    }
  }
  async update(id: string, partialDoc: Partial<CategoryModel>) {
    if (partialDoc?.slug) await this.trackerSlugChanges(id, partialDoc.slug)
    const newDoc = await this.model.findOneAndUpdate(
      { _id: id },
      {
        ...partialDoc,
      },
      {
        new: true,
      },
    )

    this.clearCache()

    this.eventManager.broadcast(BusinessEvents.CATEGORY_CREATE, newDoc, {
      scope: EventScope.TO_SYSTEM_VISITOR,
    })
    return newDoc
  }
  async deleteById(id: string) {
    const category = await this.model.findById(id)
    if (!category) {
      throw new NoContentCanBeModifiedException()
    }
    const postsInCategory = await this.findPostsInCategory(category.id)
    if (postsInCategory.length > 0) {
      throw new BadRequestException('该分类中有其他文章，无法被删除')
    }
    const res = await this.model.deleteOne({
      _id: category._id,
    })
    if ((await this.model.countDocuments({})) === 0) {
      await this.createDefaultCategory()
    }
    this.clearCache()

    this.eventManager.broadcast(BusinessEvents.CATEGORY_DELETE, id, {
      scope: EventScope.ALL,
    })
    return res
  }

  private clearCache() {
    return scheduleManager.batch(() =>
      this.eventManager.emit(EventBusEvents.CleanAggregateCache, null, {
        scope: EventScope.TO_SYSTEM,
      }),
    )
  }

  async createDefaultCategory() {
    if ((await this.model.countDocuments()) === 0) {
      return await this.model.create({
        name: '默认分类',
        slug: 'default',
      })
    }
  }
}
