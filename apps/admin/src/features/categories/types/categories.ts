import type { CategoryEntity } from '~/data/resources/category'

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
      category: CategoryEntity
      kind: 'edit'
    }
