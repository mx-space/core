import { describe, expect, it } from 'vitest'

import type { DraftModel } from '~/models/draft'
import { DraftRefType } from '~/models/draft'

import { buildWritingItems } from './desk'

function draft(over: {
  documentId: string
  id: string
  refId?: string | null
  relation?: DraftModel['relationToPublished']
  text?: string
  updatedAt: string
}): DraftModel {
  return {
    document: {
      refId: over.refId ?? null,
      refType: DraftRefType.Post,
    },
    documentId: over.documentId,
    headRevision: { text: over.text ?? '', title: over.id },
    id: over.id,
    relationToPublished: over.relation ?? null,
    status: 'active',
    updatedAt: over.updatedAt,
  } as unknown as DraftModel
}

describe('buildWritingItems', () => {
  it('collapses branches per document and drops published-identical drafts', () => {
    const items = buildWritingItems(
      [
        draft({
          documentId: 'doc-a',
          id: 'a1',
          refId: 'p1',
          relation: 'descendant',
          updatedAt: '2026-09-14',
        }),
        draft({
          documentId: 'doc-a',
          id: 'a2',
          refId: 'p1',
          relation: 'diverged',
          updatedAt: '2026-09-10',
        }),
        draft({
          documentId: 'doc-b',
          id: 'b1',
          text: '  第一段\n\n second  line ',
          updatedAt: '2026-09-12',
        }),
        draft({
          documentId: 'doc-c',
          id: 'c1',
          refId: 'p3',
          relation: 'same',
          updatedAt: '2026-09-13',
        }),
      ],
      [{ id: 'n1', nid: 1, publicAt: '2026-09-22', title: 'later' }],
    )
    expect(
      items.map((item) => [item.id, item.status, item.branchCount]),
    ).toEqual([
      ['doc-a', 'modified', 2],
      ['doc-b', 'unpublished', 1],
      ['n1', 'scheduled', 0],
    ])
    expect(items[0].draftId).toBe('a1')
    expect(items[1]).toMatchObject({ chars: 13, excerpt: '第一段 second line' })
  })
})
