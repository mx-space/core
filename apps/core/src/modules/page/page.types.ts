import type { PageRow } from './page.repository'

export type PageModel = PageRow

export const PAGE_PROTECTED_KEYS = ['id', 'createdAt'] as const
