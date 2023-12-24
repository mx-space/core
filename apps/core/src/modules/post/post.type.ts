import type { CategoryModel } from '../category/category.model'
import type { PostModel } from './post.model'

export type NormalizedPost = Omit<PostModel, 'category'> & {
  category: CategoryModel
}
