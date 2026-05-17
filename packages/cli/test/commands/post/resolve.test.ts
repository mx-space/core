import { describe, expect, it, vi } from 'vitest'

import { resolvePostId, resolvePostReadPath } from '../../../src/commands/post/resolve'

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

describe('post slug resolution', () => {
  it('resolves ordinary post slugs through get-url and category slug', async () => {
    const client = mockClient({
      '/posts/get-url/hello-world': { path: '/writing/hello-world' },
    })

    await expect(resolvePostReadPath(client, 'hello-world')).resolves.toBe(
      '/posts/writing/hello-world',
    )
    expect(client.request).toHaveBeenCalledWith('/posts/get-url/hello-world')
  })

  it('resolves post ids by reading the resolved category route', async () => {
    const client = mockClient({
      '/posts/get-url/hello-world': { path: '/writing/hello-world' },
      '/posts/writing/hello-world': { id: 'post-1' },
    })

    await expect(resolvePostId(client, 'hello-world')).resolves.toBe('post-1')
  })

  it('keeps snowflake ids on the id route', async () => {
    const client = mockClient({})

    await expect(resolvePostReadPath(client, '123456789012345')).resolves.toBe(
      '/posts/123456789012345',
    )
    expect(client.request).not.toHaveBeenCalled()
  })
})
