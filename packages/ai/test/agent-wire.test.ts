import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import {
  applyFilePatch,
  createFilePatch,
  hashAgentText,
  hashAgentValue,
} from '../src/agent-wire'

describe('agent wire hashing', () => {
  it('hashes equal values to the same digest', async () => {
    const a = await hashAgentValue(['system one', 'system two'])
    const b = await hashAgentValue(['system one', 'system two'])
    expect(a).toBe(b)
    expect(a).toMatch(/^[\da-f]{64}$/)
  })

  it('hashes different values to different digests', async () => {
    const a = await hashAgentValue([{ name: 'bash' }])
    const b = await hashAgentValue([{ name: 'load_skill' }])
    expect(a).not.toBe(b)
  })

  it('hashes text as sha256 hex of its utf-8 bytes', async () => {
    const text = '<doc>\n  <p>你好</p>\n</doc>'
    expect(await hashAgentText(text)).toBe(
      createHash('sha256').update(text, 'utf8').digest('hex'),
    )
  })

  it('hashes objects independently of their key order', async () => {
    expect(
      await hashAgentValue([
        { description: 'd', name: 'bash', parameters: { b: 1, a: [{ y: 1, x: 2 }] } },
      ]),
    ).toBe(
      await hashAgentValue([
        { name: 'bash', parameters: { a: [{ x: 2, y: 1 }], b: 1 }, description: 'd' },
      ]),
    )
  })
})

describe('agent wire file patches', () => {
  const cases: Array<[string, string, string]> = [
    ['edit in the middle', 'a\nb\nc\n', 'a\nB\nc\n'],
    ['no trailing newline', '<doc>\n  <p>x</p>\n</doc>', '<doc>\n  <p>y</p>\n</doc>'],
    ['unicode and emoji', '第一行\n第二行 🎉\n', '第一行\n改过的第二行 🎉\n'],
    ['crlf lines', 'one\r\ntwo\r\n', 'one\r\nTWO\r\n'],
    ['empty base', '', 'fresh\ncontent'],
    ['to empty', 'gone\n', ''],
    ['unchanged', 'same\n', 'same\n'],
  ]

  it.each(cases)('round-trips %s', (_name, base, next) => {
    expect(applyFilePatch(base, createFilePatch(base, next))).toBe(next)
  })

  it('returns null when the patch does not fit the base', () => {
    const patch = createFilePatch('a\nb\nc\n', 'a\nB\nc\n')
    expect(applyFilePatch('x\ny\nz\n', patch)).toBeNull()
  })
})
