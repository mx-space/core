import { deletePost, patchPost } from '~/api/posts'
import { defineCollection } from '~/data/resource/collection'
import { CategoryType } from '~/models/category'
import type { Category, PostModel } from '~/models/post'

import type { CategoryEntity } from './category'
import { categories } from './category'

function toCategoryEntity(category: Category): CategoryEntity {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    type:
      category.type === CategoryType.Tag
        ? CategoryType.Tag
        : CategoryType.Category,
  }
}

export const posts = defineCollection<PostModel>({
  name: 'post',
  getKey: (post) => post.id,
  normalize: (post) => {
    if (post.category) categories.upsert(toCategoryEntity(post.category))
  },
  onUpdate: ({ id, patch }) => patchPost(id, patch),
  onDelete: ({ id }) => deletePost(id),
})
