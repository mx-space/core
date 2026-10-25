import { createHash, randomBytes } from 'node:crypto'

import { Injectable } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'
import { WsBusService } from '~/processors/gateway/ws/ws-bus.service'

import { CollabRepository } from './collab.repository'
import type { CollabIdentity } from './collab-room.service'
import { CollabRoomService, CollabWsEvents } from './collab-room.service'
import { DraftRepository } from './draft.repository'
import { DraftService } from './draft.service'

const INVITE_TTL_MS = 7 * 24 * 3600 * 1000
const IDENTITY_TTL_MS = 60_000

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex')

export type AcceptedInvite =
  | { documentId: string; role: 'collaborator' }
  | {
      documentId: string
      draftId: string
      refId: string | null
      refType: string
      role: 'owner'
    }

@Injectable()
export class CollabService {
  private readonly identities = new Map<
    string,
    { at: number; identity: Promise<CollabIdentity | null> }
  >()

  private ownerId: { at: number; id: Promise<string | null> } | null = null

  constructor(
    private readonly repository: CollabRepository,
    private readonly draftRepository: DraftRepository,
    private readonly drafts: DraftService,
    private readonly rooms: CollabRoomService,
    private readonly bus: WsBusService,
  ) {}

  async createInvite(
    documentId: string,
    options: { expiresInDays?: number; maxUses?: number | null },
  ) {
    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(
      Date.now() +
        (options.expiresInDays
          ? options.expiresInDays * 24 * 3600 * 1000
          : INVITE_TTL_MS),
    )
    const invite = await this.repository.createInvite({
      documentId,
      expiresAt,
      maxUses: options.maxUses ?? null,
      tokenHash: hashToken(token),
    })
    return {
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt,
      id: invite.id,
      maxUses: invite.maxUses,
      token,
      uses: invite.uses,
    }
  }

  async listInvites(documentId: string) {
    const invites = await this.repository.listInvites(documentId)
    return invites.map(({ createdAt, expiresAt, id, maxUses, uses }) => ({
      createdAt,
      expiresAt,
      id,
      maxUses,
      uses,
    }))
  }

  revokeInvite(documentId: string, inviteId: string) {
    return this.repository.revokeInvite(documentId, inviteId)
  }

  async accept(token: string, readerId: string): Promise<AcceptedInvite> {
    const identity = await this.identityOf(readerId)
    if (identity?.kind === 'owner') {
      const result = await this.repository.peekInvite(hashToken(token))
      if (!result.ok) {
        throw createAppException(AppErrorCode.COLLAB_INVITE_INVALID, {
          reason: result.reason,
        })
      }
      const document = await this.draftRepository.findDocumentById(
        result.documentId,
      )
      return {
        documentId: String(result.documentId),
        draftId: await this.draftIdOf(result.documentId),
        refId: document?.refId ? String(document.refId) : null,
        refType: String(document?.refType ?? ''),
        role: 'owner',
      }
    }
    const result = await this.repository.acceptInvite(
      hashToken(token),
      readerId,
    )
    if (!result.ok) {
      throw createAppException(AppErrorCode.COLLAB_INVITE_INVALID, {
        reason: result.reason,
      })
    }
    const documentId = String(result.documentId)
    this.bus.publish({
      event: CollabWsEvents.collaboratorsChanged,
      ns: 'admin',
      payload: { documentId },
    })
    return { documentId, role: 'collaborator' }
  }

  async workspaceFor(documentId: string, readerId: string) {
    await this.assertMember(documentId, readerId)
    const [document, draftId, collaborators, identity] = await Promise.all([
      this.draftRepository.findDocumentById(documentId),
      this.draftIdOf(documentId),
      this.repository.listCollaborators(documentId),
      this.identityOf(readerId),
    ])
    return {
      collaborators: collaborators
        .filter((person) => !person.removedAt)
        .map(({ avatar, name }) => ({ avatar, name })),
      documentId,
      draftId,
      me: identity!.user,
      refType: String(document?.refType ?? ''),
    }
  }

  async exportCrdt(
    documentId: string,
    readerId: string,
    since: Uint8Array | undefined,
  ) {
    await this.assertMember(documentId, readerId)
    return this.drafts.exportCrdt(await this.draftIdOf(documentId), since)
  }

  async importCrdt(documentId: string, readerId: string, bytes: Uint8Array) {
    await this.assertMember(documentId, readerId)
    await this.drafts.importCrdt(
      await this.draftIdOf(documentId),
      bytes,
      undefined,
      `human:${readerId}`,
    )
    await this.repository.markContributed(documentId, readerId)
  }

  listCollaborators(documentId: string) {
    return this.repository.listCollaborators(documentId)
  }

  setShowInByline(documentId: string, readerId: string, show: boolean) {
    return this.repository.setShowInByline(documentId, readerId, show)
  }

  async removeCollaborator(documentId: string, readerId: string) {
    const removed = await this.repository.removeCollaborator(
      documentId,
      readerId,
    )
    this.rooms.revoke(documentId, readerId)
    return removed
  }

  async ownerIdentity(): Promise<CollabIdentity | null> {
    if (!this.ownerId || Date.now() - this.ownerId.at >= IDENTITY_TTL_MS) {
      const id = this.repository.ownerId()
      this.ownerId = { at: Date.now(), id }
      id.catch(() => {
        this.ownerId = null
      })
    }
    const ownerId = await this.ownerId.id
    return ownerId ? this.identityOf(ownerId) : null
  }

  identityOf(readerId: string): Promise<CollabIdentity | null> {
    const cached = this.identities.get(readerId)
    if (cached && Date.now() - cached.at < IDENTITY_TTL_MS) {
      return cached.identity
    }
    const identity = this.repository
      .presenceUserOf(readerId)
      .then((row): CollabIdentity | null => {
        if (!row) return null
        const user = { avatar: row.avatar, id: row.id, name: row.name }
        return row.role === 'owner'
          ? { kind: 'owner', user }
          : { kind: 'reader', readerId: row.id, user }
      })
    this.identities.set(readerId, { at: Date.now(), identity })
    identity.catch(() => this.identities.delete(readerId))
    return identity
  }

  private async assertMember(documentId: string, readerId: string) {
    const identity = await this.identityOf(readerId)
    if (identity?.kind === 'owner') return
    if (!(await this.repository.isCollaborator(documentId, readerId))) {
      throw createAppException(AppErrorCode.COLLAB_FORBIDDEN)
    }
  }

  private async draftIdOf(documentId: string) {
    const [branch] =
      await this.draftRepository.findBranchesByDocument(documentId)
    if (!branch) {
      throw createAppException(AppErrorCode.DRAFT_NOT_FOUND, {
        id: documentId,
      })
    }
    return String(branch.id)
  }
}
