import { describe, expect, it } from 'vitest'

import {
  annotateDiffNotes,
  resolveDiffNotes,
} from '../../../src/cli/author/diff-note'
import type { LexicalState } from '../../../src/services/Lexical'

const p = (text: string) => ({
  type: 'paragraph',
  children: [{ type: 'text', text }],
})
const state = (...blocks: unknown[]): LexicalState => ({
  root: { type: 'root', children: blocks },
})

describe('annotateDiffNotes', () => {
  it('marks replace, delete and insert against the base', () => {
    const base = state(p('a'), p('b'), p('c'))
    const next = state(p('a'), p('B'), p('d'), p('e'))
    const children = annotateDiffNotes(base, next).root.children as Array<
      Record<string, unknown>
    >

    expect(children.map((c) => c.type)).toEqual([
      'paragraph',
      'agent-diff',
      'agent-diff',
      'agent-diff',
    ])
    expect(children[1]).toMatchObject({
      opType: 'replace',
      originalNode: p('b'),
      proposedNode: p('B'),
    })
    expect(children[2]).toMatchObject({
      opType: 'replace',
      originalNode: p('c'),
      proposedNode: p('d'),
    })
    expect(children[3]).toMatchObject({
      opType: 'insert',
      originalNode: null,
      proposedNode: p('e'),
    })
  })

  it('marks a lone removal as delete', () => {
    const children = annotateDiffNotes(state(p('a'), p('b')), state(p('a')))
      .root.children as Array<Record<string, unknown>>
    expect(children[1]).toMatchObject({ opType: 'delete', originalNode: p('b') })
  })

  it('leaves an identical document untouched', () => {
    const next = state(p('a'))
    expect(annotateDiffNotes(state(p('a')), next)).toEqual(next)
  })
})

describe('resolveDiffNotes', () => {
  it('projects each side back to plain blocks', () => {
    const annotated = annotateDiffNotes(
      state(p('a'), p('b'), p('c')),
      state(p('a'), p('B'), p('d')),
    )
    expect(resolveDiffNotes(annotated, 'original')).toEqual(
      state(p('a'), p('b'), p('c')),
    )
    expect(resolveDiffNotes(annotated, 'proposed')).toEqual(
      state(p('a'), p('B'), p('d')),
    )
  })
})
