import type { RecentlyRow } from './recently.repository'

export type RefType = {
  type: 'post' | 'note' | 'page'
  id: string
}

export type RecentlyModel = RecentlyRow
