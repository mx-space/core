import type { DraftCard, DraftModel } from '~/models/draft'

export function cardFromDraft(draft: DraftModel): DraftCard {
  const published = draft.document.publishedRevisionId
  return {
    baseRevisionId: draft.baseRevisionId,
    createdAt: draft.createdAt,
    document: {
      id: draft.document.id,
      publishedRevisionId: published,
      refId: draft.document.refId,
      refType: draft.document.refType,
    },
    documentId: draft.documentId,
    headRevision: {
      contentFormat: draft.headRevision.contentFormat,
      createdAt: draft.headRevision.createdAt,
      id: draft.headRevision.id,
      title: draft.headRevision.title,
    },
    headRevisionId: draft.headRevisionId,
    id: draft.id,
    relation: !published
      ? 'fresh'
      : published === draft.headRevisionId
        ? 'in_sync'
        : 'ahead',
    status: draft.status,
    storage: { crdtBytes: 0, revisionBytes: 0, revisionCount: 0 },
    updatedAt: draft.updatedAt,
  }
}
