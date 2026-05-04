import type { EntityId } from '~/shared/id/entity-id'

export interface PageRow {
  id: EntityId
  title: string
  slug: string
  subtitle: string | null
  text: string
  content: string | null
  contentFormat: string
  images: unknown[] | null
  meta: Record<string, unknown> | null
  order: number
  createdAt: Date
  modifiedAt: Date | null
}

export interface PageCreateInput {
  title: string
  slug: string
  subtitle?: string | null
  text?: string | null
  content?: string | null
  contentFormat: string
  images?: unknown[] | null
  meta?: Record<string, unknown> | null
  order?: number
}

export type PagePatchInput = Partial<PageCreateInput>

export type PageModel = PageRow

export const PAGE_PROTECTED_KEYS = ['id', 'createdAt'] as const
