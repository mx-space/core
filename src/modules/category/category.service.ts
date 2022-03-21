import { Inject, Injectable, forwardRef } from '@nestjs/common'
import { DocumentType, ReturnModelType } from '@typegoose/typegoose'
import { omit } from 'lodash'
import { FilterQuery } from 'mongoose'
import { PostModel } from '../post/post.model'
import { PostService } from '../post/post.service'
import { CategoryModel, CategoryType } from './category.model'
import { InjectModel } from '~/transformers/model.transformer'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'

@Injectable()
export class CategoryService {
  constructor(
    @InjectModel(CategoryModel)
    private readonly categoryModel: ReturnModelType<typeof CategoryModel>,
    @Inject(forwardRef(() => PostService))
    private readonly postService: PostService,
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

    for (let i = 0; i < data.length; i++) {
      Reflect.set(data[i], 'count', counts[i])
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
    if (!posts.length) {
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

  async createDefaultCategory() {
    if ((await this.model.countDocuments()) === 0) {
      return await this.model.create({
        name: '默认分类',
        slug: 'default',
      })
    }
  }
}
