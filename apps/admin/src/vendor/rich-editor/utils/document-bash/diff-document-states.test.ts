import type { AgentOperation } from '@haklex/rich-agent-core'
import type { SerializedEditorState, SerializedLexicalNode } from 'lexical'
import { describe, expect, it } from 'vitest'

import { diffDocumentStates } from './diff-document-states'

function para(id: string | undefined, text: string): SerializedLexicalNode {
  return {
    type: 'paragraph',
    version: 1,
    children: [
      {
        type: 'text',
        text,
        version: 1,
        detail: 0,
        format: 0,
        mode: 'normal',
        style: '',
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    textFormat: 0,
    textStyle: '',
    ...(id ? { $: { blockId: id } } : {}),
  } as SerializedLexicalNode
}

function state(children: SerializedLexicalNode[]): SerializedEditorState {
  return {
    root: {
      type: 'root',
      version: 1,
      children,
      direction: null,
      format: '',
      indent: 0,
    },
  } as SerializedEditorState
}

function insertAfter(
  ops: AgentOperation[],
  blockId: string,
): Extract<AgentOperation, { op: 'insert' }> | undefined {
  return ops.find(
    (op): op is Extract<AgentOperation, { op: 'insert' }> =>
      op.op === 'insert' &&
      op.position.type === 'after' &&
      op.position.blockId === blockId,
  )
}

describe('diffDocumentStates', () => {
  it('returns no operations when the trees match', () => {
    const doc = state([para('a', 'Hello'), para('b', 'World')])
    const result = diffDocumentStates(doc, doc)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.operations).toEqual([])
  })

  it('emits replace when a block keeps its id but changes content', () => {
    const base = state([para('a', 'Hello'), para('b', 'World')])
    const next = state([para('a', 'Hello'), para('b', 'Earth')])
    const result = diffDocumentStates(base, next)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.operations).toEqual([
      {
        op: 'replace',
        blockId: 'b',
        node: para('b', 'Earth'),
      },
    ])
  })

  it('emits delete when a block id disappears', () => {
    const base = state([para('a', 'Hello'), para('b', 'World')])
    const next = state([para('a', 'Hello')])
    const result = diffDocumentStates(base, next)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.operations).toEqual([{ op: 'delete', blockId: 'b' }])
  })

  it('emits insert after the preceding block for a new id', () => {
    const base = state([para('a', 'Hello'), para('c', 'Tail')])
    const next = state([
      para('a', 'Hello'),
      para('b', 'Middle'),
      para('c', 'Tail'),
    ])
    const result = diffDocumentStates(base, next)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const inserted = insertAfter(result.operations, 'a')
    expect(inserted?.node).toEqual(para('b', 'Middle'))
  })

  it('inserts at root index 0 when the first block is new', () => {
    const base = state([para('b', 'World')])
    const next = state([para('a', 'Hello'), para('b', 'World')])
    const result = diffDocumentStates(base, next)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.operations[0]).toMatchObject({
      op: 'insert',
      position: { type: 'root', index: 0 },
    })
  })

  it('mints ids for new blocks that omit them', () => {
    const base = state([para('a', 'Hello')])
    const next = state([para('a', 'Hello'), para(undefined, 'New')])
    const result = diffDocumentStates(base, next)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const insert = result.operations.find((op) => op.op === 'insert')
    expect(insert?.op).toBe('insert')
    if (insert?.op !== 'insert') return
    const minted = (insert.node as { $?: { blockId?: string } }).$?.blockId
    expect(minted).toEqual(expect.any(String))
    expect(minted).not.toBe('a')
    expect(result.mintedIds).toEqual([minted])
  })

  it('rejects a same-length rewrite that drops most original ids', () => {
    const base = state([
      para('a', 'One'),
      para('b', 'Two'),
      para('c', 'Three'),
      para('d', 'Four'),
    ])
    const next = state([
      para(undefined, 'One'),
      para(undefined, 'Two'),
      para(undefined, 'Three'),
      para(undefined, 'Four'),
    ])
    const result = diffDocumentStates(base, next)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('ids_stripped')
  })
})
