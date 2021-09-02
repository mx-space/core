import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
} from '@nestjs/common'
import { omit } from 'lodash'
import { FilterQuery, PaginateOptions } from 'mongoose'
import { InjectModel } from 'nestjs-typegoose'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { EventTypes } from '~/processors/gateway/events.types'
import { WebEventsGateway } from '~/processors/gateway/web/events.gateway'
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

    // TODO: clean cache
    process.nextTick(async () => {
      this.webgateway.broadcast(EventTypes.POST_CREATE, {
        ...res.toJSON(),
        category,
      })
      // TODO
      // this.service.RecordImageDimensions(newPostDocument._id)
    })

    return res
  }

  async findById(id: string) {
    const doc = await this.postModel.findById(id).populate('category')
    if (!doc) {
      throw new CannotFindException()
    }
    return doc
  }

  async updateById(id: string, data: Partial<PostModel>) {
    // 看看 category 改了没
    const { categoryId } = data
    if (categoryId) {
      const category = await this.categoryService.findCategoryById(
        categoryId as any as string,
      )
      if (!category) {
        throw new BadRequestException('分类不存在')
      }
    }
    await this.postModel.updateOne(
      {
        _id: id,
      },
      omit(data, ['id', '_id']),
    )
  }

  async deletePost(id: string) {
    await Promise.all([
      this.model.deleteOne({ _id: id }),
      this.commentModel.deleteMany({ pid: id }),
    ])
    process.nextTick(() => {
      this.webgateway.broadcast(EventTypes.POST_DELETE, id)
    })
  }

  async getCategoryBySlug(slug: string) {
    return await this.categoryService.model.findOne({ slug })
  }

  async isAvailableSlug(slug: string) {
    return !!(await this.postModel.countDocuments({ slug }))
  }
}
