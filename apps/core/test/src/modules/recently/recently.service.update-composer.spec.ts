import { describe, expect, it, vi } from 'vitest'

import { CollectionRefTypes } from '~/constants/db.constant'
import { RecentlyService } from '~/modules/recently/recently.service'
import type { RecentlyRow } from '~/modules/recently/recently.types'

const row = (overrides: Partial<RecentlyRow> = {}): RecentlyRow => ({
  id: '1' as RecentlyRow['id'],
  content: 'edited',
  type: 'text',
  metadata: null,
  refType: null,
  refId: null,
  commentsIndex: 0,
  allowComment: true,
  up: 0,
  down: 0,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  modifiedAt: new Date('2026-01-02T00:00:00Z'),
  ...overrides,
})

function makeService(returned: RecentlyRow) {
  const update = vi.fn().mockResolvedValue(returned)
  const service = Object.create(RecentlyService.prototype) as any
  service.recentlyRepository = { update }
  service.databaseService = { findGlobalById: vi.fn() }
  service.urlExtractor = { extractFromMarkdown: vi.fn(() => []) }
  service.warmEnrichments = vi.fn()
  service.attachEnrichments = vi.fn(async (rows: RecentlyRow[]) => rows)
  service.eventManager = { emit: vi.fn().mockResolvedValue(undefined) }
  return {
    service: service as RecentlyService,
    update,
    databaseService: service.databaseService,
  }
}

describe('RecentlyService mobile composer update', () => {
  it('persists an explicit empty link selection and clears context', async () => {
    const metadata = { selectedEnrichmentUrls: [] }
    const { service, update } = makeService(row({ metadata }))

    await service.update('1', {
      content: 'edited',
      clearRef: true,
      metadata,
    })

    expect(update).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({
        content: 'edited',
        metadata,
        refId: null,
        refType: null,
      }),
    )
  })

  it('derives refType from the selected entity instead of trusting the client', async () => {
    const { service, update, databaseService } = makeService(
      row({
        refType: CollectionRefTypes.Note,
        refId: '42' as RecentlyRow['refId'],
      }),
    )
    databaseService.findGlobalById.mockResolvedValue({
      type: CollectionRefTypes.Note,
      document: {},
    })

    await service.update('1', {
      content: 'edited',
      ref: '42',
      refType: CollectionRefTypes.Post,
    })

    expect(update).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({
        refId: '42',
        refType: CollectionRefTypes.Note,
      }),
    )
  })
})
