import { createHash } from 'node:crypto'

import { describe, expect, it, vi } from 'vitest'

import { AppErrorCode } from '~/common/errors/app-error-code'
import { CollabService } from '~/modules/draft/collab.service'

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex')

const setup = () => {
  const repository = {
    acceptInvite: vi.fn(async () => ({ documentId: 'doc-1', ok: true })),
    createInvite: vi.fn(async (input: any) => ({
      createdAt: new Date(0),
      documentId: input.documentId,
      expiresAt: input.expiresAt,
      id: 'inv-1',
      maxUses: input.maxUses,
      tokenHash: input.tokenHash,
      uses: 0,
    })),
    isCollaborator: vi.fn(async () => true),
    listCollaborators: vi.fn(async () => [
      {
        avatar: 'https://a.test/bob.png',
        contributedAt: null,
        createdAt: new Date(0),
        name: 'Bob',
        readerId: 'r1',
        showInByline: true,
      },
    ]),
    markContributed: vi.fn(async () => undefined),
    ownerId: vi.fn(async () => 'owner-1'),
    peekInvite: vi.fn(async () => ({ documentId: 'doc-1', ok: true })),
    presenceUserOf: vi.fn(async (id: string) =>
      id === 'owner-1'
        ? { avatar: null, id, name: 'Owner', role: 'owner' }
        : { avatar: null, id, name: `Reader ${id}`, role: 'reader' },
    ),
    removeCollaborator: vi.fn(async () => true),
  }
  const draftRepository = {
    findBranchesByDocument: vi.fn(async () => [{ id: 'draft-1' }]),
    findDocumentById: vi.fn(async () => ({
      id: 'doc-1',
      refId: 'post-1',
      refType: 'post',
    })),
  }
  const drafts = {
    exportCrdt: vi.fn(async () => new Uint8Array([1])),
    importCrdt: vi.fn(async () => undefined),
  }
  const rooms = { revoke: vi.fn() }
  const service = new CollabService(
    repository as never,
    draftRepository as never,
    drafts as never,
    rooms as never,
  )
  return { draftRepository, drafts, repository, rooms, service }
}

describe('CollabService', () => {
  it('stores only the hash of a fresh invite token and returns the token once', async () => {
    const { repository, service } = setup()

    const invite = await service.createInvite('doc-1', { maxUses: 3 })

    expect(invite.token).toMatch(/^[\w-]{43}$/)
    expect(repository.createInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc-1',
        maxUses: 3,
        tokenHash: sha256(invite.token),
      }),
    )
    expect(invite.expiresAt.getTime() - Date.now()).toBeGreaterThan(
      6.9 * 24 * 3600 * 1000,
    )
  })

  it('accepts an invite for a reader and points them at the document', async () => {
    const { repository, service } = setup()

    const result = await service.accept('tok', 'r1')

    expect(repository.acceptInvite).toHaveBeenCalledWith(sha256('tok'), 'r1')
    expect(result).toEqual({ documentId: 'doc-1', role: 'collaborator' })
  })

  it('sends the owner opening an invite to their own draft without joining', async () => {
    const { repository, service } = setup()
    repository.peekInvite.mockResolvedValueOnce({
      documentId: 'doc-9',
      ok: true,
    })

    const result = await service.accept('tok', 'owner-1')

    expect(repository.acceptInvite).not.toHaveBeenCalled()
    expect(result).toEqual({
      documentId: 'doc-9',
      draftId: 'draft-1',
      refId: 'post-1',
      refType: 'post',
      role: 'owner',
    })
  })

  it('reports why an invite cannot be used', async () => {
    const { repository, service } = setup()
    repository.acceptInvite.mockResolvedValueOnce({
      ok: false,
      reason: 'expired',
    } as never)

    await expect(service.accept('tok', 'r1')).rejects.toMatchObject({
      code: AppErrorCode.COLLAB_INVITE_INVALID,
    })
  })

  it('opens the shared draft only for collaborators', async () => {
    const { repository, service } = setup()

    expect(await service.workspaceFor('doc-1', 'r1')).toEqual({
      collaborators: [{ avatar: 'https://a.test/bob.png', name: 'Bob' }],
      documentId: 'doc-1',
      draftId: 'draft-1',
      me: { avatar: null, id: 'r1', name: 'Reader r1' },
      refType: 'post',
    })

    repository.isCollaborator.mockResolvedValueOnce(false)
    await expect(service.workspaceFor('doc-1', 'r2')).rejects.toMatchObject({
      code: AppErrorCode.COLLAB_FORBIDDEN,
    })
  })

  it('signs a co-author HTTP update with their reader id and records it', async () => {
    const { drafts, repository, service } = setup()

    await service.importCrdt('doc-1', 'r1', new Uint8Array([5]))

    expect(drafts.importCrdt).toHaveBeenCalledWith(
      'draft-1',
      new Uint8Array([5]),
      undefined,
      'human:r1',
    )
    expect(repository.markContributed).toHaveBeenCalledWith('doc-1', 'r1')
  })

  it('refuses HTTP sync for readers who are not collaborators', async () => {
    const { drafts, repository, service } = setup()
    repository.isCollaborator.mockResolvedValue(false)

    await expect(
      service.exportCrdt('doc-1', 'r2', undefined),
    ).rejects.toMatchObject({ code: AppErrorCode.COLLAB_FORBIDDEN })
    await expect(
      service.importCrdt('doc-1', 'r2', new Uint8Array([1])),
    ).rejects.toMatchObject({ code: AppErrorCode.COLLAB_FORBIDDEN })
    expect(drafts.importCrdt).not.toHaveBeenCalled()
  })

  it('drops a removed collaborator from the live room', async () => {
    const { rooms, service } = setup()

    await service.removeCollaborator('doc-1', 'r1')

    expect(rooms.revoke).toHaveBeenCalledWith('doc-1', 'r1')
  })

  it('resolves the owner and readers to the identities the room stamps', async () => {
    const { service } = setup()

    expect(await service.identityOf('owner-1')).toEqual({
      kind: 'owner',
      user: { avatar: null, id: 'owner-1', name: 'Owner' },
    })
    expect(await service.identityOf('r1')).toEqual({
      kind: 'reader',
      readerId: 'r1',
      user: { avatar: null, id: 'r1', name: 'Reader r1' },
    })
  })

  it('looks the owner up once rather than on every frame', async () => {
    const { repository, service } = setup()

    await service.ownerIdentity()
    await service.ownerIdentity()
    await service.ownerIdentity()

    expect(repository.ownerId).toHaveBeenCalledTimes(1)
    expect(repository.presenceUserOf).toHaveBeenCalledTimes(1)
  })
})
