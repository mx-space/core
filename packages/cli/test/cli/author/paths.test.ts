import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  pickAuthorPort,
  resolveAuthorSpaDir,
} from '../../../src/cli/author/paths'

const fakeCliRoot = () => {
  const repo = mkdtempSync(join(tmpdir(), 'mxs-repo-'))
  const root = join(repo, 'packages', 'cli')
  mkdirSync(root, { recursive: true })
  return root
}

describe('resolveAuthorSpaDir', () => {
  it('uses dist/vendor/author when the vendored SPA exists', () => {
    const root = fakeCliRoot()
    const spa = join(root, 'dist', 'vendor', 'author')
    mkdirSync(spa, { recursive: true })
    writeFileSync(join(spa, 'index.html'), '<html></html>')
    expect(resolveAuthorSpaDir(root, false)).toBe(spa)
  })

  it('falls back to apps/admin/dist-author when running from source', () => {
    const root = fakeCliRoot()
    const admin = join(root, '..', '..', 'apps', 'admin', 'dist-author')
    mkdirSync(admin, { recursive: true })
    writeFileSync(join(admin, 'index.html'), '<html></html>')
    expect(resolveAuthorSpaDir(root, true)).toBe(admin)
  })

  it('throws when the SPA is missing', () => {
    const root = fakeCliRoot()
    expect(() => resolveAuthorSpaDir(root, false)).toThrowError(
      expect.objectContaining({ _tag: 'Generic' }),
    )
    expect(() => resolveAuthorSpaDir(root, true)).toThrowError(
      expect.objectContaining({ _tag: 'Generic' }),
    )
  })
})

describe('pickAuthorPort', () => {
  it('fails when --port is occupied', async () => {
    const holder = createServer()
    const port = await new Promise<number>((resolve) => {
      holder.listen(0, '127.0.0.1', () => {
        const addr = holder.address()
        resolve(typeof addr === 'object' && addr ? addr.port : 0)
      })
    })
    await expect(pickAuthorPort(port)).rejects.toMatchObject({
      _tag: 'Generic',
    })
    await new Promise<void>((resolve) => holder.close(() => resolve()))
  })

  it('returns the requested port when it is free', async () => {
    const holder = createServer()
    const port = await new Promise<number>((resolve) => {
      holder.listen(0, '127.0.0.1', () => {
        const addr = holder.address()
        resolve(typeof addr === 'object' && addr ? addr.port : 0)
      })
    })
    await new Promise<void>((resolve) => holder.close(() => resolve()))
    await expect(pickAuthorPort(port)).resolves.toBe(port)
  })
})
