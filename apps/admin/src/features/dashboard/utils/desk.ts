import type { DeskScheduledNote } from '~/api/aggregate'
import { getEditPathForDraft } from '~/features/drafts/utils/draft-edit-path'
import type { DraftModel, DraftRefType } from '~/models/draft'

import { deskWritingItemLimit } from '../constants'

export type DeskWritingItem =
  | {
      id: string
      kind: 'draft'
      refType: DraftRefType
      title: string
      to: string
      updatedAt: string
    }
  | {
      id: string
      kind: 'scheduled'
      publicAt: string
      title: string
      to: string
    }

export function buildWritingItems(
  drafts: DraftModel[],
  scheduledNotes: DeskScheduledNote[],
): DeskWritingItem[] {
  const draftItems = drafts.map<DeskWritingItem>((draft) => ({
    id: draft.id,
    kind: 'draft',
    refType: draft.document.refType,
    title: draft.headRevision.title,
    to: getEditPathForDraft(draft),
    updatedAt: draft.updatedAt ?? draft.createdAt,
  }))
  const scheduledItems = scheduledNotes.map<DeskWritingItem>((note) => ({
    id: note.id,
    kind: 'scheduled',
    publicAt: note.publicAt,
    title: note.title ?? '',
    to: `/notes/edit?id=${encodeURIComponent(note.id)}`,
  }))

  return [...draftItems, ...scheduledItems].slice(0, deskWritingItemLimit)
}

export function resolveGreetingKey(hour: number) {
  if (hour < 12) return 'dashboard.desk.greeting.morning' as const
  if (hour < 18) return 'dashboard.desk.greeting.afternoon' as const
  return 'dashboard.desk.greeting.evening' as const
}

export function formatVersionLabel(version: string) {
  return /^\d/.test(version) ? `v${version}` : version
}
