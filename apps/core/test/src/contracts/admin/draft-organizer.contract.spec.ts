import { describe, expect, it } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { DraftCleanupController } from '~/modules/draft/draft-cleanup.controller'
import { DraftCleanupService } from '~/modules/draft/draft-cleanup.service'

import { createE2EApp } from '../../../helper/create-e2e-app'
import { authPassHeader } from '../../../mock/guard/auth.guard'

const item = {
  bytes: 1024,
  documentId: '7000000000000000100',
  draftCount: 2,
  hasChanges: true,
  lastEditedAt: new Date('2026-01-01T00:00:00Z'),
  refType: 'page',
  revisionCount: 4,
  title: 'Old article',
  version: 'a'.repeat(32),
}

describe('Draft organizer contract', () => {
  const proxy = createE2EApp({
    controllers: [DraftCleanupController],
    providers: [
      {
        provide: DraftCleanupService,
        useValue: {
          organizerPreview: async () => [item],
          organize: async () => ({
            organized: 1,
            skipped: [],
            freed: { bytes: 1024, drafts: 2, revisions: 4, crdtDocs: 0 },
          }),
        },
      },
    ],
  })

  it('returns metadata for cross-page selection in the response envelope', async () => {
    const res = await proxy.app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/drafts/organize/preview?older_than_days=90`,
      headers: authPassHeader,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual([
      expect.objectContaining({
        document_id: item.documentId,
        has_changes: true,
        draft_count: 2,
      }),
    ])
    expect(res.json().data[0]).not.toHaveProperty('draft_ids')
  })

  it('executes an explicit selection with a preview version', async () => {
    const res = await proxy.app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/drafts/organize`,
      headers: authPassHeader,
      payload: {
        items: [{ documentId: item.documentId, version: item.version }],
        discardChanges: true,
      },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data).toMatchObject({
      organized: 1,
      freed: { drafts: 2 },
      skipped: [],
    })
  })

  it.each([
    { items: [] },
    { items: [{ documentId: item.documentId }] },
    { items: [{ documentId: item.documentId, version: 'bad' }] },
    { items: [item, item] },
  ])(
    'rejects an empty, unversioned or duplicate selection',
    async (payload) => {
      const res = await proxy.app.inject({
        method: 'POST',
        url: `${apiRoutePrefix}/drafts/organize`,
        headers: authPassHeader,
        payload: { ...payload, discardChanges: true },
      })
      expect(res.statusCode).toBe(422)
    },
  )
})
