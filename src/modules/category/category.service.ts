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

    private postService: PostService,
  ) {}

  findCategoryById(categoryId: string) {
    return this.categoryModel.findById(categoryId)
  }
}
