import type { CreateCategoryData } from '~/api/categories'
import { createCategory } from '~/api/categories'

import type { CategoryEntity } from './category'
import { categories } from './category'

export async function saveCategory(
  mode: { kind: 'create' } | { kind: 'edit'; id: string },
  form: { name: string; slug: string },
): Promise<CategoryEntity | void> {
  if (mode.kind === 'edit') {
    return categories.update(mode.id, (draft) => {
      draft.name = form.name
      draft.slug = form.slug
    })
  }

  const data: CreateCategoryData = { name: form.name, slug: form.slug }
  const result = await createCategory(data)
  categories.upsert(result)
  return result
}

export function removeCategory(id: string): Promise<void> {
  return categories.delete(id)
}
