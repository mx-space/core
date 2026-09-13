import { describe, expect, it } from 'vitest'

import { mergeRevision } from './merge'

const p = (id: string, text: string) =>
  ({
    type: 'paragraph',
    version: 1,
    $: { blockId: id },
    children: [{ type: 'text', text, version: 1 }],
  }) as never

const types = (r: ReturnType<typeof mergeRevision>) =>
  r.children.map((b) =>
    b.type === 'agent-diff'
      ? `${(b as unknown as { opType: string }).opType}`
      : 'p',
  )

describe('mergeRevision', () => {
  const base = [p('a', 'A'), p('b', 'B'), p('c', 'C')]

  it('keeps local on equal, notes remote-only replace with base as original', () => {
    const r = mergeRevision(base, base, [
      p('a', 'A'),
      p('b', 'B2'),
      p('c', 'C'),
    ])
    expect(types(r)).toEqual(['p', 'replace', 'p'])
    expect(r.children[1]).toMatchObject({
      originalNode: p('b', 'B'),
      proposedNode: p('b', 'B2'),
    })
    expect(r.conflicts).toBe(0)
  })

  it('uses the local block as original when both sides edited it', () => {
    const local = [p('a', 'A'), p('b', 'B-human'), p('c', 'C')]
    const r = mergeRevision(base, local, [
      p('a', 'A'),
      p('b', 'B-ai'),
      p('c', 'C'),
    ])
    expect(r.children[1]).toMatchObject({
      originalNode: p('b', 'B-human'),
      proposedNode: p('b', 'B-ai'),
    })
    expect(r.conflicts).toBe(1)
  })

  it('keeps human edits on blocks the remote left alone', () => {
    const local = [p('a', 'A-human'), p('b', 'B'), p('c', 'C')]
    const r = mergeRevision(base, local, [
      p('a', 'A'),
      p('b', 'B2'),
      p('c', 'C'),
    ])
    expect(r.children[0]).toEqual(p('a', 'A-human'))
  })

  it('turns a replace of a locally deleted block into an insert conflict', () => {
    const local = [p('a', 'A'), p('c', 'C')]
    const r = mergeRevision(base, local, [
      p('a', 'A'),
      p('b', 'B2'),
      p('c', 'C'),
    ])
    expect(types(r)).toEqual(['p', 'insert', 'p'])
    expect(r.conflicts).toBe(1)
  })

  it('notes a remote delete; conflict if human edited that block', () => {
    const clean = mergeRevision(base, base, [p('a', 'A'), p('c', 'C')])
    expect(types(clean)).toEqual(['p', 'delete', 'p'])
    expect(clean.conflicts).toBe(0)
    const edited = mergeRevision(
      base,
      [p('a', 'A'), p('b', 'B-human'), p('c', 'C')],
      [p('a', 'A'), p('c', 'C')],
    )
    expect(edited.children[1]).toMatchObject({
      opType: 'delete',
      originalNode: p('b', 'B-human'),
    })
    expect(edited.conflicts).toBe(1)
  })

  it('drops a remote delete the human already made', () => {
    const r = mergeRevision(
      base,
      [p('a', 'A'), p('c', 'C')],
      [p('a', 'A'), p('c', 'C')],
    )
    expect(types(r)).toEqual(['p', 'p'])
    expect(r.conflicts).toBe(0)
  })

  it('places an insert after the preceding remote block, walking back past locally deleted ones', () => {
    const local = [p('a', 'A'), p('c', 'C')]
    const r = mergeRevision(base, local, [
      p('a', 'A'),
      p('b', 'B'),
      p('x', 'X'),
      p('c', 'C'),
    ])
    expect(types(r)).toEqual(['p', 'insert', 'p'])
    expect(r.children[1]).toMatchObject({ proposedNode: p('x', 'X') })
  })

  it('prepends an insert at the head and keeps human-inserted blocks', () => {
    const local = [p('h', 'H'), ...base]
    const r = mergeRevision(base, local, [p('x', 'X'), ...base])
    expect(types(r)).toEqual(['insert', 'p', 'p', 'p', 'p'])
    expect(r.children[1]).toEqual(p('h', 'H'))
  })

  it('resolves pending diff notes to proposed before merging', () => {
    const pending = {
      type: 'agent-diff',
      opType: 'replace',
      originalNode: p('b', 'B'),
      proposedNode: p('b', 'B1'),
    } as never
    const r = mergeRevision(
      [p('a', 'A'), p('b', 'B1')],
      [p('a', 'A'), pending],
      [p('a', 'A'), p('b', 'B2')],
    )
    expect(r.children[1]).toMatchObject({
      originalNode: p('b', 'B1'),
      proposedNode: p('b', 'B2'),
    })
    expect(r.conflicts).toBe(0)
  })
})

describe('mergeRevision without ids on the remote side', () => {
  const bare = (text: string) =>
    ({
      type: 'paragraph',
      version: 1,
      children: [{ type: 'text', text, version: 1 }],
    }) as never
  it('matches hydrated (id-carrying) blocks to id-less remote blocks by content', () => {
    const base = [p('a', 'A'), p('b', 'B')]
    const r = mergeRevision(base, base, [bare('A'), bare('B2')])
    expect(types(r)).toEqual(['p', 'replace'])
    expect(r.children[0]).toEqual(p('a', 'A'))
    expect(r.conflicts).toBe(0)
  })
  it('still finds a human-edited block by id when the remote replaced it', () => {
    const base = [p('a', 'A'), p('b', 'B')]
    const r = mergeRevision(
      base,
      [p('a', 'A'), p('b', 'B-human')],
      [bare('A'), bare('B-ai')],
    )
    expect(r.children[1]).toMatchObject({
      opType: 'replace',
      originalNode: p('b', 'B-human'),
    })
    expect(r.conflicts).toBe(1)
  })
})
