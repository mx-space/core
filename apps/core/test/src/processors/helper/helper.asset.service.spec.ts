import fs from 'node:fs/promises'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { USER_ASSET_DIR } from '~/constants/path.constant'
import {
  AssetService,
  resolveAssetPath,
} from '~/processors/helper/helper.asset.service'

describe('AssetService path validation', () => {
  const root = path.resolve('/tmp/mx-space-assets')

  it('resolves nested asset paths inside the root', () => {
    expect(resolveAssetPath(root, 'images/avatar.png')).toBe(
      path.join(root, 'images/avatar.png'),
    )
  })

  it('rejects paths that escape the root', () => {
    expect(() => resolveAssetPath(root, '../secret.txt')).toThrow(
      'Asset path escapes root',
    )
  })

  it('rejects absolute paths outside the root', () => {
    expect(() => resolveAssetPath(root, '/etc/passwd')).toThrow(
      'Asset path escapes root',
    )
  })
})

describe('AssetService getAsset', () => {
  const service = new AssetService()
  const userOverrideRel = '/email-template/guest.template.ejs'
  const userOverrideAbs = path.join(USER_ASSET_DIR, userOverrideRel)

  afterEach(async () => {
    await fs.rm(userOverrideAbs, { force: true })
  })

  it('returns bundled text as string when encoding option is supplied', async () => {
    const out = await service.getAsset('/markdown/markdown.css', {
      encoding: 'utf-8',
    })
    expect(typeof out).toBe('string')
    expect((out as string).length).toBeGreaterThan(0)
  })

  it('returns bundled text as Buffer when no encoding is supplied', async () => {
    const out = await service.getAsset('/markdown/markdown.css')
    expect(Buffer.isBuffer(out)).toBe(true)
  })

  it('accepts a path with no leading slash', async () => {
    const withSlash = await service.getAsset('/markdown/markdown.css', {
      encoding: 'utf-8',
    })
    const withoutSlash = await service.getAsset('markdown/markdown.css', {
      encoding: 'utf-8',
    })
    expect(withoutSlash).toBe(withSlash)
  })

  it('throws when neither user override nor embed entry exists', async () => {
    await expect(service.getAsset('/nope/missing.ejs')).rejects.toThrow(
      'Asset not found',
    )
  })

  it('prefers user override over the bundled embed', async () => {
    const stub = '<!-- user override -->'
    await fs.mkdir(path.dirname(userOverrideAbs), { recursive: true })
    await fs.writeFile(userOverrideAbs, stub, 'utf-8')

    const out = await service.getAsset(userOverrideRel, { encoding: 'utf-8' })
    expect(out).toBe(stub)
  })
})

describe('AssetService write/remove user assets', () => {
  const service = new AssetService()
  const rel = '/email-template/__test__.template.ejs'
  const abs = path.join(USER_ASSET_DIR, rel)

  beforeEach(async () => {
    await fs.rm(abs, { force: true })
  })

  afterEach(async () => {
    await fs.rm(abs, { force: true })
  })

  it('writes a user asset to disk and reads it back', async () => {
    await service.writeUserCustomAsset(rel, 'payload', { encoding: 'utf-8' })
    const out = await service.getAsset(rel, { encoding: 'utf-8' })
    expect(out).toBe('payload')
  })

  it('removes a user asset', async () => {
    await service.writeUserCustomAsset(rel, 'payload', { encoding: 'utf-8' })
    await service.removeUserCustomAsset(rel)
    await expect(fs.access(abs)).rejects.toThrow()
  })
})
