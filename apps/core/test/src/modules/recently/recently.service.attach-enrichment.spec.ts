import { describe, expect, it, vi } from 'vitest'

import type { EnrichmentResult } from '~/modules/enrichment/enrichment.types'
import { UrlExtractorService } from '~/modules/enrichment/url-extractor.service'
import { RecentlyService } from '~/modules/recently/recently.service'
import type { RecentlyRow } from '~/modules/recently/recently.types'

function makeRow(overrides: Partial<RecentlyRow> = {}): RecentlyRow {
  return {
    id: '1' as RecentlyRow['id'],
    content: 'https://github.com/vercel/next.js',
    type: 'link',
    metadata: null,
    refType: null,
    refId: null,
    commentsIndex: 0,
    allowComment: true,
    up: 0,
    down: 0,
    createdAt: new Date('2026-01-01'),
    modifiedAt: null,
    ...overrides,
  }
}

function makeService(stubs: { hydrateUrls?: ReturnType<typeof vi.fn> }) {
  const enrichmentService = {
    hydrateUrls:
      stubs.hydrateUrls ??
      vi.fn(async () => ({}) as Record<string, EnrichmentResult>),
  }
  const service = Object.create(RecentlyService.prototype) as any
  service.enrichmentService = enrichmentService
  service.urlExtractor = new UrlExtractorService()
  return { service: service as RecentlyService, enrichmentService }
}

const callAttach = (svc: RecentlyService, rows: RecentlyRow[]) =>
  (svc as any).attachEnrichments(rows) as Promise<
    Array<RecentlyRow & { enrichments: Record<string, EnrichmentResult> }>
  >

describe('RecentlyService.attachEnrichments', () => {
  it('returns [] for empty input', async () => {
    const { service, enrichmentService } = makeService({})
    const out = await callAttach(service, [])
    expect(out).toEqual([])
    expect(enrichmentService.hydrateUrls).not.toHaveBeenCalled()
  })

  it('skips hydrateUrls when no row carries a URL', async () => {
    const { service, enrichmentService } = makeService({})
    const rows = [makeRow({ content: 'plain text, no link' })]
    const out = await callAttach(service, rows)
    expect(out[0].enrichments).toEqual({})
    expect(enrichmentService.hydrateUrls).not.toHaveBeenCalled()
  })

  it('batches the hydrate call and dedupes URLs across rows', async () => {
    const result: EnrichmentResult = {
      title: 'Next.js',
      url: 'https://github.com/vercel/next.js',
      category: 'developer' as any,
      fetchedAt: '2026-01-01T00:00:00Z',
    } as EnrichmentResult
    const hydrate = vi.fn(async () => ({
      'https://github.com/vercel/next.js': result,
    }))
    const { service, enrichmentService } = makeService({ hydrateUrls: hydrate })
    const rows = [
      makeRow({ id: '1' as RecentlyRow['id'] }),
      makeRow({ id: '2' as RecentlyRow['id'] }),
      makeRow({ id: '3' as RecentlyRow['id'], content: 'no url here' }),
    ]
    const out = await callAttach(service, rows)
    expect(enrichmentService.hydrateUrls).toHaveBeenCalledTimes(1)
    expect(enrichmentService.hydrateUrls).toHaveBeenCalledWith(
      ['https://github.com/vercel/next.js'],
      undefined,
    )
    expect(out[0].enrichments).toEqual({
      'https://github.com/vercel/next.js': result,
    })
    expect(out[1].enrichments).toEqual({
      'https://github.com/vercel/next.js': result,
    })
    expect(out[2].enrichments).toEqual({})
  })

  it('keys each row by its own URLs', async () => {
    const a: EnrichmentResult = {
      title: 'A',
      url: 'https://example.com/a',
      category: 'website' as any,
      fetchedAt: '2026-01-01T00:00:00Z',
    } as EnrichmentResult
    const b: EnrichmentResult = {
      title: 'B',
      url: 'https://example.com/b',
      category: 'website' as any,
      fetchedAt: '2026-01-01T00:00:00Z',
    } as EnrichmentResult
    const hydrate = vi.fn(async () => ({
      'https://example.com/a': a,
      'https://example.com/b': b,
    }))
    const { service } = makeService({ hydrateUrls: hydrate })
    const rows = [
      makeRow({ id: '1' as RecentlyRow['id'], content: 'https://example.com/a' }),
      makeRow({ id: '2' as RecentlyRow['id'], content: 'https://example.com/b' }),
    ]
    const out = await callAttach(service, rows)
    expect(out[0].enrichments).toEqual({ 'https://example.com/a': a })
    expect(out[1].enrichments).toEqual({ 'https://example.com/b': b })
  })

  it('returns {} per-row when a URL is missing from the map', async () => {
    const hydrate = vi.fn(async () => ({}))
    const { service } = makeService({ hydrateUrls: hydrate })
    const out = await callAttach(service, [makeRow({})])
    expect(out[0].enrichments).toEqual({})
  })

  it('swallows hydrate failures and returns {} per-row', async () => {
    const hydrate = vi.fn(async () => {
      throw new Error('boom')
    })
    const { service } = makeService({ hydrateUrls: hydrate })
    const out = await callAttach(service, [makeRow({})])
    expect(out[0].enrichments).toEqual({})
  })
})
