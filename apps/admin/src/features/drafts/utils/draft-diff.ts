import type { ContentRevision, RevisionSnapshot } from '~/models/draft'

import type { DraftDiffStats, VersionItem } from '../types/drafts'

export function buildVersionItems(
  headRevisionId: string,
  revisions: ContentRevision[] | undefined,
): VersionItem[] {
  return (revisions ?? []).map((revision) => ({
    id: revision.id,
    isCurrent: revision.id === headRevisionId,
    savedAt: revision.createdAt,
    title: revision.title,
  }))
}

export function computeDiffStats(
  selected: RevisionSnapshot,
  current: RevisionSnapshot,
): DraftDiffStats {
  const selectedText = getDraftTextForDiff(selected)
  const currentText = getDraftTextForDiff(current)
  return {
    delta: currentText.length - selectedText.length,
    isSame: selectedText === currentText,
  }
}

export function getDraftTextForDiff(revision: RevisionSnapshot) {
  if (revision.contentFormat === 'lexical' && revision.content) {
    return revision.text || revision.content
  }
  return revision.text || revision.content || ''
}
