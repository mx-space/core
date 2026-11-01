import { describe, expect, it } from 'vitest'

import type { RevisionSnapshot } from '~/models/draft'

import { summarizeDraftChanges } from './change-summary'

function paragraph(blockId: string, text: string) {
  return {
    $: { blockId },
    children: [{ text, type: 'text', version: 1 }],
    type: 'paragraph',
    version: 1,
  }
}

function lexical(
  ...blocks: Array<ReturnType<typeof paragraph>>
): RevisionSnapshot {
  return {
    content: JSON.stringify({ root: { children: blocks, type: 'root' } }),
    contentFormat: 'lexical',
    images: null,
    meta: null,
    text: '',
    title: 't',
    typeSpecificData: null,
  }
}

function markdown(text: string): RevisionSnapshot {
  return {
    content: null,
    contentFormat: 'markdown',
    images: null,
    meta: null,
    text,
    title: 't',
    typeSpecificData: null,
  }
}

describe('summarizeDraftChanges', () => {
  it('pairs lexical blocks by blockId', () => {
    const published = lexical(
      paragraph('a', 'Intro'),
      paragraph('b', 'Old body'),
      paragraph('c', 'Gone'),
    )
    const draft = lexical(
      paragraph('a', 'Intro'),
      paragraph('b', 'New body'),
      paragraph('d', 'Fresh section'),
    )
    const summary = summarizeDraftChanges(published, draft)
    expect(summary).toMatchObject({
      added: 1,
      changed: 1,
      fresh: false,
      removed: 1,
    })
    expect(summary.blocks).toEqual([
      { before: 'Old body', kind: 'changed', text: 'New body' },
      { kind: 'added', text: 'Fresh section' },
      { kind: 'removed', text: 'Gone' },
    ])
  })

  it('reads text nested inside container blocks', () => {
    const banner = (blockId: string, text: string, innerId: string) => ({
      $: { blockId },
      bannerType: 'note',
      content: { root: { children: [paragraph(innerId, text)], type: 'root' } },
      type: 'banner',
      version: 1,
    })
    const summary = summarizeDraftChanges(
      lexical(
        banner('b', 'Same note', 'x1') as never,
        banner('c', 'Old', 'y1') as never,
      ),
      lexical(
        banner('b', 'Same note', 'x2') as never,
        banner('c', 'New', 'y1') as never,
      ),
    )
    expect(summary).toMatchObject({ added: 0, changed: 1, removed: 0 })
    expect(summary.blocks).toEqual([
      { before: 'Old', kind: 'changed', text: 'New' },
    ])
  })

  it('counts a markdown paragraph inserted mid-document as one addition', () => {
    const summary = summarizeDraftChanges(
      markdown('First\n\nSecond\n\nThird'),
      markdown('First\n\nSecond\n\nInserted\n\nThird'),
    )
    expect(summary).toMatchObject({ added: 1, changed: 0, removed: 0 })
    expect(summary.blocks).toEqual([{ kind: 'added', text: 'Inserted' }])
  })

  it('pairs a rewritten markdown paragraph as a change', () => {
    const summary = summarizeDraftChanges(
      markdown('First\n\nSecond'),
      markdown('First\n\nSecond, revised'),
    )
    expect(summary).toMatchObject({ added: 0, changed: 1, removed: 0 })
  })

  it('shows the first blocks of a fresh draft', () => {
    const summary = summarizeDraftChanges(
      null,
      markdown('One\n\nTwo\n\nThree\n\nFour\n\nFive'),
    )
    expect(summary.fresh).toBe(true)
    expect(summary.blocks.map((block) => block.text)).toEqual([
      'One',
      'Two',
      'Three',
      'Four',
    ])
  })

  it('flags edits outside the body text', () => {
    const before = lexical(paragraph('a', 'Same'))
    const after = { ...lexical(paragraph('a', 'Same')), title: 'Renamed' }
    expect(summarizeDraftChanges(before, after)).toMatchObject({
      changed: 0,
      otherChanges: true,
    })
  })

  it('reports nothing for identical content', () => {
    const doc = lexical(paragraph('a', 'Same'))
    expect(summarizeDraftChanges(doc, doc)).toMatchObject({
      added: 0,
      otherChanges: false,
      blocks: [],
      changed: 0,
      removed: 0,
      wordDelta: 0,
    })
  })

  it('measures the word delta across CJK and latin text', () => {
    const summary = summarizeDraftChanges(
      markdown('你好'),
      markdown('你好世界 hello world'),
    )
    expect(summary.wordDelta).toBe(4)
  })
})
