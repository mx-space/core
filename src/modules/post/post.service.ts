import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
} from '@nestjs/common'
import { isDefined } from 'class-validator'
import { omit } from 'lodash'
import { FilterQuery, PaginateOptions } from 'mongoose'
import { InjectModel } from 'nestjs-typegoose'
import { CacheService } from '~/processors/cache/cache.service'
import { EventTypes } from '~/processors/gateway/events.types'
import { WebEventsGateway } from '~/processors/gateway/web/events.gateway'
import { ImageService } from '~/processors/helper/helper.image.service'
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
    private readonly webgateway: WebEventsGateway,
    private readonly imageService: ImageService,
    private readonly cacheService: CacheService,
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
      await Promise.all([
        this.cacheService.clearAggregateCache(),
        this.webgateway.broadcast(EventTypes.POST_CREATE, {
          ...res.toJSON(),
          category,
        }),
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
      // 更新图片信息缓存
      await Promise.all([
        this.imageService.recordImageDimensions(this.postModel, id),
        this.webgateway.broadcast(
          EventTypes.POST_UPDATE,
          await this.postModel.findById(id),
        ),
        this.cacheService.clearAggregateCache(),
      ])
    })

    return updated
  }

  async deletePost(id: string) {
    await Promise.all([
      this.model.deleteOne({ _id: id }),
      this.commentModel.deleteMany({ pid: id }),
    ])
    process.nextTick(async () => {
      await this.webgateway.broadcast(EventTypes.POST_DELETE, id)
    })
  }

  async getCategoryBySlug(slug: string) {
    return await this.categoryService.model.findOne({ slug })
  }

  async isAvailableSlug(slug: string) {
    return !!(await this.postModel.countDocuments({ slug }))
  }
}
