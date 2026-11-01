import type { TranslationKey } from '~/i18n/types'
import type { CleanupCategory } from '~/models/draft'

export const CLEANUP_CATEGORIES: CleanupCategory[] = ['B', 'A', 'E', 'C', 'D']

export const CLEANUP_CATEGORY_COPY: Record<
  CleanupCategory,
  { description: TranslationKey; title: TranslationKey }
> = {
  A: {
    description: 'drafts.cleanup.inSync.description',
    title: 'drafts.cleanup.inSync.title',
  },
  B: {
    description: 'drafts.cleanup.revisions.description',
    title: 'drafts.cleanup.revisions.title',
  },
  C: {
    description: 'drafts.cleanup.crdt.description',
    title: 'drafts.cleanup.crdt.title',
  },
  D: {
    description: 'drafts.cleanup.orphans.description',
    title: 'drafts.cleanup.orphans.title',
  },
  E: {
    description: 'drafts.cleanup.test.description',
    title: 'drafts.cleanup.test.title',
  },
}

export function defaultCleanupPicks() {
  return new Set<CleanupCategory>(CLEANUP_CATEGORIES)
}
