import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { NodeContext } from '@effect/platform-node'
import { Effect } from 'effect'
import { beforeEach, describe, expect, it } from 'vitest'

import { readContentSpec, readJsonSpec } from '../../src/domain/content-spec'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mxs-content-spec-'))
})

const run = <A>(eff: Effect.Effect<A, any, any>) =>
  Effect.runPromise(Effect.provide(eff, NodeContext.layer) as Effect.Effect<A>)

describe('readContentSpec', () => {
  it('returns null when no content spec is provided', async () => {
    await expect(run(readContentSpec(undefined))).resolves.toBeNull()
  })

  it('treats ordinary values as inline content', async () => {
    await expect(run(readContentSpec('plain text'))).resolves.toEqual({
      text: 'plain text',
      origin: 'inline',
    })
  })

  it('reads file= paths relative to the provided cwd', async () => {
    await fs.writeFile(path.join(tmpDir, 'body.md'), '# title\n', 'utf8')
    await expect(
      run(readContentSpec('file=body.md', { cwd: tmpDir })),
    ).resolves.toEqual({
      text: '# title\n',
      origin: 'file',
      path: path.join(tmpDir, 'body.md'),
    })
  })

  it('wraps file read failures as ValidationFailed', async () => {
    const err = await run(
      Effect.flip(readContentSpec('file=missing.md', { cwd: tmpDir })),
    )
    expect(err._tag).toBe('ValidationFailed')
    expect(err.message).toContain('failed to read')
  })

  it('rejects stdin specs when stdin is a TTY', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY')
    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      value: true,
    })
    try {
      const err = await run(Effect.flip(readContentSpec('-')))
      expect(err._tag).toBe('ValidationFailed')
      expect(err.message).toContain('stdin is a TTY')
    } finally {
      if (descriptor) Object.defineProperty(process.stdin, 'isTTY', descriptor)
    }
  })
})

describe('readJsonSpec', () => {
  it('returns undefined when no JSON spec is provided', async () => {
    await expect(run(readJsonSpec(undefined))).resolves.toBeUndefined()
  })

  it('parses inline JSON', async () => {
    await expect(run(readJsonSpec('{"a":1}'))).resolves.toEqual({ a: 1 })
  })

  it('parses JSON from file=', async () => {
    const filePath = path.join(tmpDir, 'meta.json')
    await fs.writeFile(filePath, '{"tags":["a","b"]}', 'utf8')
    await expect(run(readJsonSpec(`file=${filePath}`))).resolves.toEqual({
      tags: ['a', 'b'],
    })
  })

  it('reports invalid inline and file JSON as ValidationFailed', async () => {
    const inlineErr = await run(Effect.flip(readJsonSpec('{')))
    expect(inlineErr._tag).toBe('ValidationFailed')

    const filePath = path.join(tmpDir, 'bad.json')
    await fs.writeFile(filePath, '{', 'utf8')
    const fileErr = await run(Effect.flip(readJsonSpec(`file=${filePath}`)))
    expect(fileErr._tag).toBe('ValidationFailed')
  })

  it('wraps file read failures for JSON specs', async () => {
    const err = await run(
      Effect.flip(readJsonSpec(`file=${path.join(tmpDir, 'missing.json')}`)),
    )
    expect(err._tag).toBe('ValidationFailed')
    expect(err.message).toContain('failed to read JSON')
  })
})
