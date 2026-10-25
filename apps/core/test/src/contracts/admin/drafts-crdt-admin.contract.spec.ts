import { describe, expect, test, vi } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { DraftController } from '~/modules/draft/draft.controller'
import { DraftService } from '~/modules/draft/draft.service'

import { createE2EApp } from '../../../helper/create-e2e-app'
import { authPassHeader } from '../../../mock/guard/auth.guard'

const id = '7000000000000000010'
const view = { headRevisionId: '7000000000000000011', id }

const service = {
  createCheckpoint: vi.fn(async () => view),
  exportCrdt: vi.fn(async () => new Uint8Array([1, 2, 3])),
  history: vi.fn(async () => ({
    changes: [
      {
        deps: [],
        id: { counter: 4, peer: '99' },
        lamport: 4,
        message: 'human:owner',
        timestamp: 1,
      },
    ],
    checkpoints: [{ id: view.headRevisionId, kind: 'save' }],
  })),
  importCrdt: vi.fn(async () => undefined),
  restore: vi.fn(async () => view),
  undo: vi.fn(async () => view),
  updateFields: vi.fn(async () => ({
    meta: null,
    typeSpecificData: { categoryId: 'c' },
  })),
}

describe('DraftController CRDT endpoints (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [DraftController],
    providers: [{ provide: DraftService, useValue: service }],
  })

  test('GET /drafts/:id/crdt returns raw bytes and decodes ?since', async () => {
    const since = Buffer.from([7, 8]).toString('base64')
    const res = await proxy.app.inject({
      headers: authPassHeader,
      method: 'GET',
      url: `${apiRoutePrefix}/drafts/${id}/crdt?since=${encodeURIComponent(since)}`,
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('application/octet-stream')
    expect([...res.rawPayload]).toEqual([1, 2, 3])
    expect([
      ...((service.exportCrdt.mock.calls[0] as unknown[])[1] as Uint8Array),
    ]).toEqual([7, 8])
  })

  test('POST /drafts/:id/crdt imports an octet-stream body', async () => {
    const res = await proxy.app.inject({
      headers: {
        ...authPassHeader,
        'content-type': 'application/octet-stream',
      },
      method: 'POST',
      payload: Buffer.from([5, 6]),
      url: `${apiRoutePrefix}/drafts/${id}/crdt`,
    })

    expect(res.statusCode).toBe(204)
    const [calledId, bytes] = service.importCrdt.mock.calls[0] as unknown as [
      string,
      Uint8Array,
    ]
    expect(calledId).toBe(id)
    expect([...bytes]).toEqual([5, 6])
  })

  test('POST /drafts/:id/checkpoints creates a checkpoint of a kind', async () => {
    const res = await proxy.app.inject({
      headers: authPassHeader,
      method: 'POST',
      payload: { kind: 'publish' },
      url: `${apiRoutePrefix}/drafts/${id}/checkpoints`,
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().data).toMatchObject({
      head_revision_id: view.headRevisionId,
    })
    expect(service.createCheckpoint).toHaveBeenCalledWith(id, 'publish')
  })

  test('PATCH /drafts/:id/fields keeps nested keys verbatim', async () => {
    const res = await proxy.app.inject({
      headers: authPassHeader,
      method: 'PATCH',
      payload: { typeSpecificData: { categoryId: 'c' } },
      url: `${apiRoutePrefix}/drafts/${id}/fields`,
    })

    expect(res.statusCode).toBe(200)
    expect(service.updateFields).toHaveBeenCalledWith(id, {
      typeSpecificData: { categoryId: 'c' },
    })
  })

  test('GET /drafts/:id/history lists checkpoints and changes', async () => {
    const res = await proxy.app.inject({
      headers: authPassHeader,
      method: 'GET',
      url: `${apiRoutePrefix}/drafts/${id}/history`,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.changes[0]).toMatchObject({
      id: { counter: 4, peer: '99' },
      message: 'human:owner',
    })
  })

  test('POST /drafts/:id/restore and /undo apply as new commits', async () => {
    const restore = await proxy.app.inject({
      headers: authPassHeader,
      method: 'POST',
      payload: { revisionId: view.headRevisionId },
      url: `${apiRoutePrefix}/drafts/${id}/restore`,
    })
    const undo = await proxy.app.inject({
      headers: authPassHeader,
      method: 'POST',
      payload: {
        before: [{ counter: 1, peer: '99' }],
        id: { counter: 4, peer: '99' },
      },
      url: `${apiRoutePrefix}/drafts/${id}/undo`,
    })

    expect(restore.statusCode).toBe(201)
    expect(undo.statusCode).toBe(201)
    expect(service.restore).toHaveBeenCalledWith(id, view.headRevisionId)
    expect(service.undo).toHaveBeenCalledWith(id, { counter: 4, peer: '99' }, [
      { counter: 1, peer: '99' },
    ])
  })
})
