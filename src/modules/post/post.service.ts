import {
  forwardRef,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common'
import { ReturnModelType } from '@typegoose/typegoose'
import { InjectModel } from 'nestjs-typegoose'
import { CategoryService } from '../category/category.service'
import { PostModel } from './post.model'

@Injectable()
export class PostService {
  constructor(
    @InjectModel(PostModel)
    private readonly postModel: ReturnModelType<typeof PostModel>,
    @Inject(forwardRef(() => CategoryService))
    private categoryService: CategoryService,
  ) {}

  async create(post: Partial<PostModel>) {
    const { categoryId } = post

    const category = await this.categoryService.findCategoryById(
      categoryId as any as string,
    )
    if (!category) {
      throw new UnprocessableEntityException('分类丢失了 ಠ_ಠ')
    }
    const res = this.postModel.create(post)
    return res
  }
}
