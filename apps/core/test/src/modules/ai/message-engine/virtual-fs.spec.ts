import { describe, expect, it } from 'vitest'

import { VirtualFs } from '~/modules/ai/message-engine/vfs/virtual-fs'

describe('VirtualFs', () => {
  it('write then read returns a defensive copy', () => {
    const fs = new VirtualFs()
    fs.write('t', { a: '1' })
    const copy = fs.read('t')
    copy.a = 'mutated'
    expect(fs.read('t')).toEqual({ a: '1' })
  })

  it('applyPatch patches existing keys and drops unknown keys', () => {
    const fs = new VirtualFs()
    fs.write('t', { a: '1', b: '2' })
    const result = fs.applyPatch('t', { a: '1x', ghost: 'nope' })
    expect(result.appliedKeys).toEqual(['a'])
    expect(result.droppedKeys).toEqual(['ghost'])
    expect(result.changes).toEqual([{ key: 'a', before: '1', after: '1x' }])
    expect(fs.read('t')).toEqual({ a: '1x', b: '2' })
  })

  it('replaceInKey replaces a unique occurrence and reports failures', () => {
    const fs = new VirtualFs()
    fs.write('t', { a: 'foo bar foo', b: 'hello world' })
    expect(fs.replaceInKey('t', 'b', 'world', 'there')).toEqual({
      ok: true,
      before: 'hello world',
      after: 'hello there',
    })
    expect(fs.read('t').b).toBe('hello there')
    expect(fs.replaceInKey('t', 'a', 'foo', 'X')).toEqual({
      ok: false,
      reason: 'find-ambiguous',
    })
    expect(fs.replaceInKey('t', 'b', 'absent', 'X')).toEqual({
      ok: false,
      reason: 'find-not-found',
    })
    expect(fs.replaceInKey('t', 'ghost', 'x', 'y')).toEqual({
      ok: false,
      reason: 'missing-key',
    })
  })

  it('journal records write and patch operations in order', () => {
    const fs = new VirtualFs()
    fs.write('t', { a: '1', b: 'hello' })
    fs.applyPatch('t', { a: '2' })
    fs.replaceInKey('t', 'b', 'hello', 'hi')
    expect(fs.journal('t')).toEqual([
      { op: 'write', keys: ['a', 'b'] },
      { op: 'patch', keys: ['a'] },
      { op: 'patch', keys: ['b'] },
    ])
  })

  it('read of unknown path returns empty object; applyPatch on unknown path drops all', () => {
    const fs = new VirtualFs()
    expect(fs.read('missing')).toEqual({})
    expect(fs.has('missing')).toBe(false)
    const result = fs.applyPatch('missing', { a: '1' })
    expect(result.appliedKeys).toEqual([])
    expect(result.droppedKeys).toEqual(['a'])
  })
})
