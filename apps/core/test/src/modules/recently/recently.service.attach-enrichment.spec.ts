import { describe, expect, it, vi } from 'vitest'

import { refKey } from '~/modules/enrichment/enrichment.service'
import type { EnrichmentResult } from '~/modules/enrichment/enrichment.types'
import { RecentlyService } from '~/modules/recently/recently.service'
import type { RecentlyRow } from '~/modules/recently/recently.types'

function makeRow(overrides: Partial<RecentlyRow> = {}): RecentlyRow {
  return {
    id: '1' as RecentlyRow['id'],
    content: '',
    type: 'link',
    metadata: { url: 'https://example.com' },
    refType: null,
    refId: null,
    commentsIndex: 0,
    allowComment: true,
    up: 0,
    down: 0,
    createdAt: new Date('2026-01-01'),
    modifiedAt: null,
    enrichmentProvider: 'gh-repo',
    enrichmentExternalId: 'vercel/next.js',
    ...overrides,
  }
}

function makeService(stubs: { hydrateRefs?: ReturnType<typeof vi.fn> }) {
  const enrichmentService = {
    hydrateRefs:
      stubs.hydrateRefs ??
      vi.fn(async () => ({}) as Record<string, EnrichmentResult>),
  }
  const service = Object.create(RecentlyService.prototype) as any
  service.enrichmentService = enrichmentService
  return { service: service as RecentlyService, enrichmentService }
}

const callAttach = (svc: RecentlyService, rows: RecentlyRow[]) =>
  (svc as any).attachEnrichment(rows) as Promise<
    Array<RecentlyRow & { enrichment?: EnrichmentResult | null }>
  >

describe('RecentlyService.attachEnrichment', () => {
  it('returns [] for empty input', async () => {
    const { service, enrichmentService } = makeService({})
    const out = await callAttach(service, [])
    expect(out).toEqual([])
    expect(enrichmentService.hydrateRefs).not.toHaveBeenCalled()
  })

  it('skips hydrateRefs when no row carries an enrichment ref', async () => {
    const { service, enrichmentService } = makeService({})
    const rows = [
      makeRow({ enrichmentProvider: null, enrichmentExternalId: null }),
    ]
    const out = await callAttach(service, rows)
    expect(out[0].enrichment).toBeNull()
    expect(enrichmentService.hydrateRefs).not.toHaveBeenCalled()
  })

  it('batches the hydrate call and dedupes refs across rows', async () => {
    const result: EnrichmentResult = {
      title: 'Next.js',
      url: 'https://github.com/vercel/next.js',
      category: 'developer' as any,
      fetchedAt: '2026-01-01T00:00:00Z',
    } as EnrichmentResult
    const hydrate = vi.fn(async () => ({
      [refKey('gh-repo', 'vercel/next.js')]: result,
    }))
    const { service, enrichmentService } = makeService({ hydrateRefs: hydrate })
    const rows = [
      makeRow({ id: '1' as RecentlyRow['id'] }),
      makeRow({ id: '2' as RecentlyRow['id'] }),
      makeRow({
        id: '3' as RecentlyRow['id'],
        enrichmentProvider: null,
        enrichmentExternalId: null,
      }),
    ]
    const out = await callAttach(service, rows)
    expect(enrichmentService.hydrateRefs).toHaveBeenCalledTimes(1)
    expect(out[0].enrichment).toBe(result)
    expect(out[1].enrichment).toBe(result)
    expect(out[2].enrichment).toBeNull()
  })

  it('returns null per-row when the ref is missing from the map', async () => {
    const hydrate = vi.fn(async () => ({}))
    const { service } = makeService({ hydrateRefs: hydrate })
    const rows = [makeRow({})]
    const out = await callAttach(service, rows)
    expect(out[0].enrichment).toBeNull()
  })

  it('swallows hydrate failures and returns null per-row', async () => {
    const hydrate = vi.fn(async () => {
      throw new Error('boom')
    })
    const { service } = makeService({ hydrateRefs: hydrate })
    const rows = [makeRow({})]
    const out = await callAttach(service, rows)
    expect(out[0].enrichment).toBeNull()
  })
})
