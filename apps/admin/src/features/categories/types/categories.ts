import type { CategoryModel } from '~/models/category'

export type SelectedItem =
  | {
      id: string
      kind: 'category'
    }
  | {
      kind: 'tag'
      name: string
    }

export type CategoryFormMode =
  | {
      kind: 'create'
    }
  | {
      category: CategoryModel
      kind: 'edit'
    }
