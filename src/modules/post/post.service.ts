import { isDefined } from 'class-validator'
import { omit } from 'lodash'
import { AggregatePaginateModel, Document } from 'mongoose'
import slugify from 'slugify'

import {
  BadRequestException,
  Inject,
  Injectable,
  forwardRef,
} from '@nestjs/common'

import { BusinessException } from '~/common/exceptions/biz.exception'
import { BusinessEvents, EventScope } from '~/constants/business-event.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { EventBusEvents } from '~/constants/event-bus.constant'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { ImageService } from '~/processors/helper/helper.image.service'
import { TextMacroService } from '~/processors/helper/helper.macro.service'
import { InjectModel } from '~/transformers/model.transformer'

import { CategoryService } from '../category/category.service'
import { CommentModel, CommentRefTypes } from '../comment/comment.model'
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

    const related = await this.checkRelated(post)
    post.related = related as any

    const res = await this.postModel.create({
      ...post,
      slug,
      categoryId: category.id,
      created: new Date(),
      modified: null,
    })

    const doc = res.toJSON()

    this.imageService.saveImageDimensionsFromMarkdownText(
      doc.text,
      doc.images,
      (images) => {
        res.images = images
        return res.save()
      },
    )

    process.nextTick(async () => {
      await Promise.all([
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

    // 有关联文章
    const related = await this.checkRelated(data)
    data.related = related.filter((item) => item !== oldDocument._id) as any

    Object.assign(oldDocument, omit(data, PostModel.protectedKeys))
    await oldDocument.save()
    process.nextTick(async () => {
      const doc = await this.postModel.findById(id).lean({ getters: true })
      // 更新图片信息缓存
      await Promise.all([
        this.eventManager.emit(EventBusEvents.CleanAggregateCache, null, {
          scope: EventScope.TO_SYSTEM,
        }),
        data.text &&
          this.imageService.saveImageDimensionsFromMarkdownText(
            data.text,
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
            },
          ),
        this.eventManager.broadcast(BusinessEvents.POST_UPDATE, doc, {
          scope: EventScope.TO_SYSTEM,
        }),
      ])
    })

    return oldDocument.toObject()
  }

  async deletePost(id: string) {
    await Promise.all([
      this.model.deleteOne({ _id: id }),
      this.commentModel.deleteMany({ ref: id, refType: CommentRefTypes.Post }),
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
    return (await this.postModel.countDocuments({ slug })) === 0
  }

  async checkRelated<
    T extends Partial<Pick<PostModel, 'related' | 'relatedId'>>,
  >(data: T): Promise<string[]> {
    const cloned = { ...data }
    // 有关联文章
    if (cloned.relatedId && cloned.relatedId.length) {
      const relatedPosts = await this.postModel.find({
        _id: { $in: cloned.relatedId },
      })
      if (relatedPosts.length !== cloned.relatedId.length) {
        throw new BadRequestException('关联文章不存在')
      } else {
        return relatedPosts.map((i) => i.id)
      }
    }
    return []
  }
}
