import { isDefined } from 'class-validator'
import { omit } from 'lodash'
import { FilterQuery, PaginateOptions } from 'mongoose'

import {
  BadRequestException,
  Inject,
  Injectable,
  forwardRef,
} from '@nestjs/common'

import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { EventBusEvents } from '~/constants/event-bus.constant'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { ImageService } from '~/processors/helper/helper.image.service'
import { InjectModel } from '~/transformers/model.transformer'

import { CategoryService } from '../category/category.service'
import { CommentModel } from '../comment/comment.model'
import { PostModel } from './post.model'

@Injectable()
export class PostService {
  constructor(
    @InjectModel(PostModel)
    private readonly postModel: MongooseModel<PostModel>,
    @InjectModel(CommentModel)
    private readonly commentModel: MongooseModel<CommentModel>,

    @Inject(forwardRef(() => CategoryService))
    private categoryService: CategoryService,
    private readonly imageService: ImageService,
    private readonly eventManager: EventManagerService,
  ) {}

  get model() {
    return this.postModel
  }
  findWithPaginator(
    condition?: FilterQuery<PostModel>,
    options?: PaginateOptions,
  ) {
    return this.postModel.paginate(condition as any, options)
  }

  async create(post: PostModel) {
    const { categoryId } = post

    const category = await this.categoryService.findCategoryById(
      categoryId as any as string,
    )
    if (!category) {
      throw new BadRequestException('分类丢失了 ಠ_ಠ')
    }
    if (await this.isAvailableSlug(post.slug)) {
      throw new BadRequestException('slug 重复')
    }
    const res = await this.postModel.create({
      ...post,
      categoryId: category.id,
      created: new Date(),
      modified: null,
    })

    process.nextTick(async () => {
      this.eventManager.emit(EventBusEvents.CleanAggregateCache, null, {
        scope: EventScope.TO_SYSTEM,
      })
      await Promise.all([
        this.eventManager.broadcast(
          BusinessEvents.POST_CREATE,
          {
            ...res.toJSON(),
            category,
          },
          {
            scope: EventScope.TO_SYSTEM_VISITOR,
          },
        ),
        this.imageService.recordImageDimensions(this.postModel, res._id),
      ])
    })

    return res
  }

  async updateById(id: string, data: Partial<PostModel>) {
    const oldDocument = await this.postModel.findById(id).lean()
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

    const updated = await this.postModel.findOneAndUpdate(
      {
        _id: id,
      },
      omit(data, PostModel.protectedKeys),
      { new: true },
    )
    process.nextTick(async () => {
      this.eventManager.emit(EventBusEvents.CleanAggregateCache, null, {
        scope: EventScope.TO_SYSTEM,
      })

      // 更新图片信息缓存
      await Promise.all([
        this.imageService.recordImageDimensions(this.postModel, id),
        this.eventManager.broadcast(
          BusinessEvents.POST_UPDATE,
          await this.postModel.findById(id).lean(),
          {
            scope: EventScope.TO_SYSTEM_VISITOR,
          },
        ),
      ])
    })

    return updated
  }

  async deletePost(id: string) {
    await Promise.all([
      this.model.deleteOne({ _id: id }),
      this.commentModel.deleteMany({ pid: id }),
    ])
    await this.eventManager.broadcast(BusinessEvents.POST_DELETE, id, {
      scope: EventScope.TO_SYSTEM_VISITOR,
      nextTick: true,
    })
  }

  async getCategoryBySlug(slug: string) {
    return await this.categoryService.model.findOne({ slug })
  }

  async isAvailableSlug(slug: string) {
    return !!(await this.postModel.countDocuments({ slug }))
  }
}
