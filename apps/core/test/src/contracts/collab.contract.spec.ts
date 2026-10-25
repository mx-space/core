import { describe, expect, test, vi } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { AuthService } from '~/modules/auth/auth.service'
import { CollabController } from '~/modules/draft/collab.controller'
import { CollabService } from '~/modules/draft/collab.service'

import { createE2EApp } from '../../helper/create-e2e-app'
import { authPassHeader } from '../../mock/guard/auth.guard'

const documentId = '7000000000000000020'

const service = {
  accept: vi.fn(async () => ({ documentId, role: 'collaborator' })),
  createInvite: vi.fn(async () => ({
    createdAt: new Date('2026-10-25T00:00:00.000Z'),
    expiresAt: new Date('2026-11-01T00:00:00.000Z'),
    id: '7000000000000000021',
    maxUses: null,
    token: 'secret-token-secret-token',
    uses: 0,
  })),
  exportCrdt: vi.fn(async () => new Uint8Array([1, 2])),
  importCrdt: vi.fn(async () => undefined),
  listCollaborators: vi.fn(async () => [
    {
      avatar: null,
      contributedAt: null,
      createdAt: new Date('2026-10-25T00:00:00.000Z'),
      name: 'Bob',
      readerId: 'r1',
      showInByline: true,
    },
  ]),
  listInvites: vi.fn(async () => []),
  removeCollaborator: vi.fn(async () => true),
  revokeInvite: vi.fn(async () => true),
  setShowInByline: vi.fn(async () => true),
  workspaceFor: vi.fn(async () => ({
    collaborators: [{ avatar: null, name: 'Bob' }],
    documentId,
    draftId: '7000000000000000022',
    me: { avatar: null, id: 'r1', name: 'Bob' },
    refType: 'post',
  })),
}

const readerHeader = { 'x-test-reader': 'r1' }

const authService = {
  getSessionUser: vi.fn(async (req: { headers: Record<string, string> }) => {
    const id = req.headers['x-test-reader']
    return id ? { user: { id, role: 'reader' } } : null
  }),
}

describe('CollabController (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [CollabController],
    providers: [
      { provide: CollabService, useValue: service },
      { provide: AuthService, useValue: authService },
    ],
  })

  test('POST /collab/documents/:id/invites returns the token once, snake_cased', async () => {
    const res = await proxy.app.inject({
      headers: authPassHeader,
      method: 'POST',
      payload: { max_uses: 5 },
      url: `${apiRoutePrefix}/collab/documents/${documentId}/invites`,
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().data).toMatchObject({
      expires_at: '2026-11-01T00:00:00.000Z',
      max_uses: null,
      token: 'secret-token-secret-token',
    })
    expect(service.createInvite).toHaveBeenCalledWith(documentId, {
      maxUses: 5,
    })
  })

  test('owner routes refuse requests without the owner session', async () => {
    const res = await proxy.app.inject({
      headers: readerHeader,
      method: 'GET',
      url: `${apiRoutePrefix}/collab/documents/${documentId}/collaborators`,
    })

    expect(res.statusCode).toBe(401)
  })

  test('PATCH and DELETE collaborators reach the service', async () => {
    const patch = await proxy.app.inject({
      headers: authPassHeader,
      method: 'PATCH',
      payload: { show_in_byline: false },
      url: `${apiRoutePrefix}/collab/documents/${documentId}/collaborators/r1`,
    })
    const remove = await proxy.app.inject({
      headers: authPassHeader,
      method: 'DELETE',
      url: `${apiRoutePrefix}/collab/documents/${documentId}/collaborators/r1`,
    })

    expect(patch.statusCode).toBe(204)
    expect(remove.statusCode).toBe(204)
    expect(service.setShowInByline).toHaveBeenCalledWith(
      documentId,
      'r1',
      false,
    )
    expect(service.removeCollaborator).toHaveBeenCalledWith(documentId, 'r1')
  })

  test('POST /collab/invites/:token/accept needs a reader session', async () => {
    const anonymous = await proxy.app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/collab/invites/secret-token-secret-token/accept`,
    })
    const signedIn = await proxy.app.inject({
      headers: readerHeader,
      method: 'POST',
      url: `${apiRoutePrefix}/collab/invites/secret-token-secret-token/accept`,
    })

    expect(anonymous.statusCode).toBe(401)
    expect(signedIn.statusCode).toBe(201)
    expect(signedIn.json().data).toEqual({
      document_id: documentId,
      role: 'collaborator',
    })
    expect(service.accept).toHaveBeenCalledWith(
      'secret-token-secret-token',
      'r1',
    )
  })

  test('GET /collab/documents/:id returns the co-author workspace', async () => {
    const res = await proxy.app.inject({
      headers: readerHeader,
      method: 'GET',
      url: `${apiRoutePrefix}/collab/documents/${documentId}`,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data).toMatchObject({
      document_id: documentId,
      draft_id: '7000000000000000022',
      me: { id: 'r1', name: 'Bob' },
    })
  })

  test('co-author CRDT sync goes over raw bytes', async () => {
    const pulled = await proxy.app.inject({
      headers: readerHeader,
      method: 'GET',
      url: `${apiRoutePrefix}/collab/documents/${documentId}/crdt`,
    })
    const pushed = await proxy.app.inject({
      headers: {
        ...readerHeader,
        'content-type': 'application/octet-stream',
      },
      method: 'POST',
      payload: Buffer.from([9]),
      url: `${apiRoutePrefix}/collab/documents/${documentId}/crdt`,
    })

    expect(pulled.headers['content-type']).toContain('application/octet-stream')
    expect([...pulled.rawPayload]).toEqual([1, 2])
    expect(pushed.statusCode).toBe(204)
    const [calledDocument, reader, bytes] = service.importCrdt.mock
      .calls[0] as unknown as [string, string, Uint8Array]
    expect([calledDocument, reader, [...bytes]]).toEqual([
      documentId,
      'r1',
      [9],
    ])
  })
})
