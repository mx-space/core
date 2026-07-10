import type { UpdateCategoryData } from '~/api/categories'
import { deleteCategory, updateCategory } from '~/api/categories'
import { defineCollection } from '~/data/resource/collection'
import type { CategoryType } from '~/models/category'

export interface CategoryEntity {
  id: string
  name: string
  slug: string
  type: CategoryType
  count?: number
  createdAt?: string
}

export const categories = defineCollection<CategoryEntity>({
  name: 'category',
  getKey: (category) => category.id,
  onUpdate: async ({ id, patch }) => {
    const data: UpdateCategoryData = {}
    if (patch.name !== undefined) data.name = patch.name
    if (patch.slug !== undefined) data.slug = patch.slug
    if (patch.type !== undefined) data.type = patch.type
    return await updateCategory(id, data)
  },
  onDelete: async ({ id }) => {
    await deleteCategory(id)
  },
})
