import type { BaseCommentIndexModel } from '~/shared/types/legacy-model.type'

export type RefType = {
  type: 'post' | 'note' | 'page'
  id: string
}

export interface RecentlyModel extends BaseCommentIndexModel {
  content: string
  type: string
  metadata?: Record<string, unknown> | null
  refType?: string | null
  refId?: string | null
  modified?: Date | null
  up?: number
  down?: number
}
