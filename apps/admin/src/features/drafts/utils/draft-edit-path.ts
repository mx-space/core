import type { DraftModel } from '~/models/draft'

import { DraftRefType as DraftRefTypeValue } from '~/models/draft'

export function getEditPathForDraft(draft: DraftModel) {
  const basePath =
    draft.refType === DraftRefTypeValue.Post
      ? '/posts/edit'
      : draft.refType === DraftRefTypeValue.Note
        ? '/notes/edit'
        : '/pages/edit'
  const params = new URLSearchParams()
  params.set('draftId', draft.id)
  if (draft.refId) params.set('id', draft.refId)

  return `${basePath}?${params.toString()}`
}
