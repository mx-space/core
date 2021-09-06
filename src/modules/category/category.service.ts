import { forwardRef, Inject, Injectable } from '@nestjs/common'
import { ReturnModelType } from '@typegoose/typegoose'
import { InjectModel } from 'nestjs-typegoose'
import { PostService } from '../post/post.service'
import { CategoryModel } from './category.model'

@Injectable()
export class CategoryService {
  constructor(
    @InjectModel(CategoryModel)
    private readonly categoryModel: ReturnModelType<typeof CategoryModel>,
    @Inject(forwardRef(() => PostService))
    private readonly postService: PostService,
  ) {}

  findCategoryById(categoryId: string) {
    return this.categoryModel.findById(categoryId)
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
}
