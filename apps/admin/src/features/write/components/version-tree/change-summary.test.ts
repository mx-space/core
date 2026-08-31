import { describe, expect, it } from 'vitest'

import type { ContentRevision } from '~/models/draft'

import { formatCharCount, summarizeRevisionChange } from './change-summary'

const revision = (
  overrides: Partial<ContentRevision> = {},
): ContentRevision => ({
  content: null,
  contentFormat: 'markdown',
  createdAt: '2026-08-31T00:00:00.000Z',
  documentId: 'document-1',
  id: 'revision-1',
  images: null,
  meta: null,
  parentRevisionId: null,
  text: '一二三',
  title: '标题',
  typeSpecificData: { summary: 'a', tags: ['x', 'y'] },
  ...overrides,
})

describe('summarizeRevisionChange', () => {
  it('reports char delta, changed fields and title changes', () => {
    const summary = summarizeRevisionChange(
      revision(),
      revision({
        text: '一二三四五',
        title: '新标题',
        typeSpecificData: { slug: 'x', summary: 'b', tags: ['y', 'x'] },
      }),
    )

    expect(summary.charDelta).toBe(2)
    expect(summary.titleChanged).toBe(true)
    expect(summary.fieldKeys).toEqual([
      'write.recovery.field.slug',
      'write.recovery.field.summary',
    ])
  })

  it('treats reordered lists and empty-ish values as unchanged', () => {
    const summary = summarizeRevisionChange(
      revision({ typeSpecificData: { slug: '', tags: ['x', 'y'] } }),
      revision({ typeSpecificData: { tags: ['y', 'x'] } }),
    )

    expect(summary).toEqual({
      charDelta: 0,
      fieldKeys: [],
      titleChanged: false,
    })
  })
})

describe('formatCharCount', () => {
  it('compacts thousands', () => {
    expect(formatCharCount(412)).toBe('412')
    expect(formatCharCount(1234)).toBe('1.2k')
  })
})
