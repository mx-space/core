import { afterEach, describe, expect, it, vi } from 'vitest'

import { mockRequestInstance } from '~/__tests__/helpers/instance'
import { ArticleController } from '~/controllers/article'

describe('article client', () => {
  const client = mockRequestInstance(ArticleController)

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('streams NDJSON lines from POST /articles/bodies', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      expect(url).toContain('/articles/bodies')
      expect(url).toContain('lang=en')
      return new Response(
        '{"id":"p1","kind":"post","unchanged":true}\n{"id":"p2","kind":"post","content":"{}","content_format":"lexical","created_at":"2026-01-01T00:00:00.000Z","modified_at":null,"text":"hi"}\n',
        {
          status: 200,
          headers: { 'content-type': 'application/x-ndjson' },
        },
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const seen: string[] = []
    const lines = await client.article.streamBodies(
      [{ id: 'p1', kind: 'post', bodyVersion: 1 }],
      {
        lang: 'en',
        onLine: (line) => seen.push(line.id),
      },
    )

    expect(fetchMock).toHaveBeenCalledOnce()
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({
      items: [{ id: 'p1', kind: 'post', bodyVersion: 1 }],
    })
    expect(seen).toEqual(['p1', 'p2'])
    expect(lines[0]).toEqual({ id: 'p1', kind: 'post', unchanged: true })
    expect(lines[1]).toMatchObject({
      id: 'p2',
      kind: 'post',
      contentFormat: 'lexical',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
  })

  it('throws RequestError when the batch is rejected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('too many', { status: 400 })),
    )

    await expect(
      client.article.streamBodies([{ id: 'p1', kind: 'post' }]),
    ).rejects.toMatchObject({ status: 400 })
  })
})
