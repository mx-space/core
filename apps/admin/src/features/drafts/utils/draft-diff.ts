import type { DraftHistoryListItem, DraftModel } from '~/models/draft'
import type { DraftDiffStats, VersionItem } from '../types/drafts'

export function buildVersionItems(
  draft: DraftModel,
  history: DraftHistoryListItem[] | undefined,
): VersionItem[] {
  const currentSavedAt = draft.updatedAt || draft.createdAt
  const currentItem: VersionItem = {
    isCurrent: true,
    savedAt: currentSavedAt,
    title: draft.title,
    version: draft.version,
  }
  const historyItems = (history ?? [])
    .filter((item) => item.version !== draft.version)
    .map((item) => ({
      baseVersion: item.baseVersion,
      isCurrent: false,
      isFullSnapshot: item.isFullSnapshot,
      refVersion: item.refVersion,
      savedAt: item.savedAt,
      title: item.title,
      version: item.version,
    }))

  return [currentItem, ...historyItems].sort((a, b) => b.version - a.version)
}

export function computeDiffStats(
  selectedDraft: DraftModel,
  currentDraft: DraftModel,
): DraftDiffStats {
  const selectedText = getDraftTextForDiff(selectedDraft)
  const currentText = getDraftTextForDiff(currentDraft)

  return {
    delta: currentText.length - selectedText.length,
    isSame: selectedText === currentText,
  }
}

export function getDraftTextForDiff(draft: DraftModel) {
  if (draft.contentFormat === 'lexical' && draft.content) {
    return draft.text || draft.content
  }

  return draft.text || draft.content || ''
}
