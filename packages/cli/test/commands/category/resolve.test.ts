import { describe, expect, it, vi } from 'vitest'

import { resolveCategoryId } from '../../../src/commands/category/resolve'

function mockClient(responses: Record<string, unknown>) {
  return {
    request: vi.fn(async (path: string) => {
      if (!(path in responses)) {
        throw new Error(`unexpected request: ${path}`)
      }
      return { ok: true, status: 200, data: responses[path] }
    }),
  } as any
}

describe('category id resolution', () => {
  it('returns snowflake ids unchanged without a request', async () => {
    const client = mockClient({})

    await expect(
      resolveCategoryId(client, '123456789012345'),
    ).resolves.toBe('123456789012345')
    expect(client.request).not.toHaveBeenCalled()
  })

  it('unwraps the double envelope returned by /categories/:slug', async () => {
    const client = mockClient({
      '/categories/blog': { data: { id: 'cat-1', name: 'Blog' } },
    })

    await expect(resolveCategoryId(client, 'blog')).resolves.toBe('cat-1')
  })

  it('throws when the envelope does not contain an id', async () => {
    const client = mockClient({
      '/categories/missing': { data: {} },
    })

    await expect(resolveCategoryId(client, 'missing')).rejects.toThrow(
      /category not found: missing/,
    )
  })

  it('percent-encodes slug characters before hitting the API', async () => {
    const client = mockClient({
      '/categories/hello%20world': { data: { id: 'cat-2' } },
    })

    await expect(resolveCategoryId(client, 'hello world')).resolves.toBe(
      'cat-2',
    )
  })
})
