import type { ReviewBatch } from '@haklex/rich-agent-core'
import type { SerializedLexicalNode } from 'lexical'
import { describe, expect, it } from 'vitest'

import {
  buildProposedState,
  buildReviewXml,
  supersedePendingBatches,
} from './review-xml'

function para(text: string, id?: string): SerializedLexicalNode {
  return {
    $: id ? { blockId: id } : undefined,
    children: [
      {
        detail: 0,
        format: 0,
        mode: 'normal',
        style: '',
        text,
        type: 'text',
        version: 1,
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    textFormat: 0,
    textStyle: '',
    type: 'paragraph',
    version: 1,
  } as SerializedLexicalNode
}

function batch(
  entries: Array<Partial<ReviewBatch['entries'][number]>>,
  status: ReviewBatch['status'] = 'pending',
): ReviewBatch {
  return {
    entries: entries.map((entry, index) => ({
      id: `e${index}`,
      originalFingerprint: '',
      status: 'pending',
      ...entry,
    })),
    id: 'b1',
    status,
  } as unknown as ReviewBatch
}

describe('buildReviewXml', () => {
  it('lists each pending proposal with its target', () => {
    const xml = buildReviewXml({
      batches: [
        batch([
          {
            op: {
              node: para('Added line', 'n1'),
              op: 'insert',
              position: { blockId: 'a', type: 'after' },
            },
          },
          { op: { blockId: 'b', node: para('New text', 'b'), op: 'replace' } },
          { op: { blockId: 'c', op: 'delete' } },
        ]),
      ],
    } as never)

    expect(xml.startsWith('<review>\n<insert after="a">\n')).toBe(true)
    expect(xml).toContain('Added line')
    expect(xml).toContain('</insert>')
    expect(xml).toContain('<replace block="b">')
    expect(xml).toContain('New text')
    expect(xml).toContain('<delete block="c"/>')
    expect(xml.trimEnd().endsWith('</review>')).toBe(true)
  })

  it('leaves out proposals the user already accepted or rejected', () => {
    const xml = buildReviewXml({
      batches: [
        batch([
          { op: { blockId: 'c', op: 'delete' }, status: 'accepted' },
          { op: { blockId: 'd', op: 'delete' }, status: 'rejected' },
        ]),
        batch([{ op: { blockId: 'e', op: 'delete' } }], 'rejected'),
      ],
    } as never)

    expect(xml).toBe('')
  })

  it('is empty without a review state', () => {
    expect(buildReviewXml(null)).toBe('')
  })
})

function doc(children: SerializedLexicalNode[]) {
  return {
    root: {
      children,
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  } as never
}

function texts(state: { root: { children: SerializedLexicalNode[] } }) {
  return state.root.children.map(
    (node) =>
      (node as unknown as { children: Array<{ text: string }> }).children[0]
        .text,
  )
}

describe('buildProposedState', () => {
  it('lays pending proposals over the accepted document', () => {
    const accepted = doc([
      para('One', 'a'),
      para('Two', 'b'),
      para('Three', 'c'),
    ])
    const proposed = buildProposedState(accepted, {
      batches: [
        batch([
          { op: { blockId: 'a', node: para('ONE', 'a'), op: 'replace' } },
          {
            op: {
              node: para('Inserted', 'n1'),
              op: 'insert',
              position: { blockId: 'b', type: 'after' },
            },
          },
          { op: { blockId: 'c', op: 'delete' } },
          { op: { blockId: 'b', op: 'delete' }, status: 'rejected' },
        ]),
      ],
    } as never)

    expect(texts(proposed as never)).toEqual(['ONE', 'Two', 'Inserted'])
  })

  it('returns the accepted document when nothing is pending', () => {
    const accepted = doc([para('One', 'a')])

    expect(texts(buildProposedState(accepted, null) as never)).toEqual(['One'])
  })
})

describe('supersedePendingBatches', () => {
  it('drops every unsettled batch except the one being kept', () => {
    const settled = { ...batch([], 'accepted'), id: 'old-done' }
    const pending = { ...batch([]), id: 'old-pending' }
    const current = { ...batch([]), id: 'current' }

    const result = supersedePendingBatches(
      { batches: [settled, pending, current] },
      'current',
    )

    expect(result.removedIds).toEqual(['old-pending'])
    expect(result.state.batches.map((b) => b.id)).toEqual([
      'old-done',
      'current',
    ])
  })
})
