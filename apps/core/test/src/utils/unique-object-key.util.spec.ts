import { describe, expect, it, vi } from 'vitest'

import { resolveUniqueObjectKey } from '~/utils/unique-object-key.util'

describe('resolveUniqueObjectKey', () => {
  it('keeps the key when nothing is stored there', async () => {
    const exists = vi.fn().mockResolvedValue(false)

    await expect(
      resolveUniqueObjectKey('image/image.png', exists),
    ).resolves.toBe('image/image.png')
    expect(exists).toHaveBeenCalledWith('image/image.png')
  })

  it('adds a suffix before the extension when the key is taken', async () => {
    const taken = new Set(['image/image.png'])
    const exists = vi.fn(async (key: string) => taken.has(key))

    const key = await resolveUniqueObjectKey('image/image.png', exists)

    expect(key).toMatch(/^image\/image-[\da-z]{6}\.png$/)
  })

  it('keeps trying until it finds a free key', async () => {
    const exists = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false)

    const key = await resolveUniqueObjectKey('a/b.tar.gz', exists)

    expect(key).toMatch(/^a\/b\.tar-[\da-z]{6}\.gz$/)
    expect(exists).toHaveBeenCalledTimes(3)
  })

  it('handles keys without an extension', async () => {
    const exists = vi.fn().mockResolvedValueOnce(true).mockResolvedValue(false)

    await expect(resolveUniqueObjectKey('README', exists)).resolves.toMatch(
      /^README-[\da-z]{6}$/,
    )
  })

  it('gives up probing and falls back to a uuid after repeated collisions', async () => {
    const exists = vi.fn().mockResolvedValue(true)

    const key = await resolveUniqueObjectKey('img/x.jpg', exists)

    expect(key).toMatch(/^img\/x-[\da-f-]{36}\.jpg$/)
  })
})
