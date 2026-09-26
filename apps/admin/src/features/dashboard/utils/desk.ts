import type { DeskScheduledNote } from '~/api/aggregate'
import { getEditPathForDraft } from '~/features/drafts/utils/draft-edit-path'
import type { DraftModel } from '~/models/draft'
import { DraftRefType } from '~/models/draft'

import { deskWritingItemLimit } from '../constants'

const excerptLength = 240

export type DeskWritingStatus = 'modified' | 'scheduled' | 'unpublished'

export interface DeskWritingItem {
  branchCount: number
  chars: number
  draftId: string | null
  excerpt: string
  id: string
  refType: DraftRefType
  status: DeskWritingStatus
  time: string
  title: string
  to: string
}

export function buildWritingItems(
  drafts: DraftModel[],
  scheduledNotes: DeskScheduledNote[],
): DeskWritingItem[] {
  const byDocument = new Map<string, DeskWritingItem>()
  for (const draft of drafts) {
    if (draft.status !== 'active' || draft.relationToPublished === 'same')
      continue
    const existing = byDocument.get(draft.documentId)
    if (existing) {
      existing.branchCount += 1
      continue
    }
    const text = draft.headRevision.text ?? ''
    byDocument.set(draft.documentId, {
      branchCount: 1,
      chars: text.replaceAll(/\s/g, '').length,
      draftId: draft.id,
      excerpt: text.replaceAll(/\s+/g, ' ').trim().slice(0, excerptLength),
      id: draft.documentId,
      refType: draft.document.refType,
      status: draft.document.refId ? 'modified' : 'unpublished',
      time: draft.updatedAt ?? draft.createdAt,
      title: draft.headRevision.title,
      to: getEditPathForDraft(draft),
    })
  }
  const scheduledItems = scheduledNotes.map<DeskWritingItem>((note) => ({
    branchCount: 0,
    chars: 0,
    draftId: null,
    excerpt: '',
    id: note.id,
    refType: DraftRefType.Note,
    status: 'scheduled',
    time: note.publicAt,
    title: note.title ?? '',
    to: `/notes/edit?id=${encodeURIComponent(note.id)}`,
  }))

  const draftItems = [...byDocument.values()].sort((a, b) =>
    b.time.localeCompare(a.time),
  )
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
