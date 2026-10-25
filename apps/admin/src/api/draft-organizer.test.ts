import { afterEach, describe, expect, it, vi } from 'vitest'

import type { OrganizerArticle } from '~/models/draft'

import { runDraftOrganizer } from './drafts'

const articles = Array.from({ length: 205 }, (_, i) => ({
  documentId: String(7000000000000000000n + BigInt(i)),
  title: `Article ${i}`,
  version: 'a'.repeat(32),
})) as OrganizerArticle[]

afterEach(() => vi.restoreAllMocks())

describe('draft organizer batches', () => {
  it('processes an entire cross-page selection exactly once with its preview versions', async () => {
    const submitted: { documentId: string; version: string }[][] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const input = JSON.parse(init!.body as string)
      submitted.push(input.items)
      expect(input.discardChanges).toBe(true)
      expect(input.items.length).toBeLessThanOrEqual(100)
      return new Response(
        JSON.stringify({
          data: {
            organized: input.items.length,
            freed: {
              bytes: input.items.length * 10,
              drafts: input.items.length * 2,
              revisions: input.items.length * 3,
              crdtDocs: 0,
            },
            skipped: [],
          },
        }),
        { headers: { 'content-type': 'application/json' } },
      )
    })

    const result = await runDraftOrganizer(articles, true)

    expect(submitted.flat()).toEqual(
      articles.map(({ documentId, version }) => ({ documentId, version })),
    )
    expect(result).toMatchObject({
      organized: 205,
      freed: { bytes: 2050, drafts: 410, revisions: 615 },
      skipped: [],
      unverified: [],
    })
  })

  it('keeps confirmed results and stops when a batch outcome is unknown', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              organized: 100,
              freed: { bytes: 1000, drafts: 100, revisions: 200, crdtDocs: 0 },
              skipped: [],
            },
          }),
        ),
      )
      .mockRejectedValue(new Error('Connection lost'))

    const result = await runDraftOrganizer(articles, true)

    expect(result.organized).toBe(100)
    expect(result.freed.bytes).toBe(1000)
    expect(result.unverified.map((item) => item.documentId)).toEqual(
      articles.slice(100).map((item) => item.documentId),
    )
    expect(result.skipped).toEqual([])
  })
})
