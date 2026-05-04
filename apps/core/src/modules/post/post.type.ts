import type { CategoryModel } from '../category/category.types'
import type { PostModel } from './post.types'

export type NormalizedPost = Omit<PostModel, 'category'> & {
  category: CategoryModel
}
