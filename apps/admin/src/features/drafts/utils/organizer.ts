import type { OrganizerArticle } from '~/models/draft'

export const organizerTotals = (items: OrganizerArticle[]) =>
  items.reduce(
    (total, item) => ({
      bytes: total.bytes + item.bytes,
      changed: total.changed + Number(item.hasChanges),
      drafts: total.drafts + item.draftCount,
      revisions: total.revisions + item.revisionCount,
    }),
    { bytes: 0, changed: 0, drafts: 0, revisions: 0 },
  )
