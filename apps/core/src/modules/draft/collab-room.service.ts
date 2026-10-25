import type { WsAckPayload } from '@mx-space/ws-client/protocol'
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common'
import { z } from 'zod'

import { AppException } from '~/common/errors/exception.types'

import { DraftService } from './draft.service'
import { type DocumentChange, DraftCrdtService } from './draft-crdt.service'

export const CollabWsEvents = {
  join: 'collab.join',
  leave: 'collab.leave',
  peerJoined: 'collab.peer.joined',
  peerLeft: 'collab.peer.left',
  presence: 'collab.presence',
  update: 'collab.update',
} as const

export const COLLAB_RELAY = Symbol('COLLAB_RELAY')

export interface CollabRelay {
  publish: (
    event: string,
    payload: unknown,
    room: string,
    exclude?: string,
  ) => void
}

export interface CollabMember {
  connectionId: string
  join: (room: string) => Promise<void>
  leave: (room: string) => Promise<void>
}

const MAX_UPDATE_BYTES = 4 * 1024 * 1024
const REJECTED = 'DRAFT_CRDT_UPDATE_REJECTED'

const base64 = z.string().max(Math.ceil((MAX_UPDATE_BYTES * 4) / 3) + 8)
const draftId = z.string().min(1).max(64)
const joinSchema = z.object({ draftId, since: base64.optional() })
const updateSchema = z.object({ draftId, update: z.string() })
const presenceSchema = z.object({ draftId, state: base64 })
const leaveSchema = z.object({ draftId })

const roomOf = (documentId: string) => `collab:${documentId}`
const encode = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')
const decode = (value: string) => new Uint8Array(Buffer.from(value, 'base64'))

const invalid: WsAckPayload = { code: 'VALIDATION_FAILED', ok: false }

@Injectable()
export class CollabRoomService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CollabRoomService.name)
  private readonly joined = new Map<string, Map<string, string>>()
  private stopListening?: () => void

  constructor(
    private readonly drafts: DraftService,
    private readonly crdt: DraftCrdtService,
    @Inject(COLLAB_RELAY) private readonly relay: CollabRelay,
  ) {}

  onModuleInit() {
    this.stopListening = this.crdt.onDocumentChanged((change) =>
      this.relayChange(change),
    )
  }

  onModuleDestroy() {
    this.stopListening?.()
  }

  async join(member: CollabMember, raw: unknown): Promise<WsAckPayload> {
    const parsed = joinSchema.safeParse(raw)
    if (!parsed.success) return invalid
    const { draftId, since } = parsed.data
    try {
      const { documentId, update } = await this.drafts.exportCrdtFor(
        draftId,
        since ? decode(since) : undefined,
      )
      const room = roomOf(documentId)
      await member.join(room)
      this.membership(member.connectionId).set(draftId, documentId)
      this.relay.publish(
        CollabWsEvents.peerJoined,
        { connectionId: member.connectionId, documentId },
        room,
        member.connectionId,
      )
      return {
        data: {
          connectionId: member.connectionId,
          documentId,
          update: encode(update),
        },
        ok: true,
      }
    } catch (error) {
      return this.failure(error)
    }
  }

  async update(member: CollabMember, raw: unknown): Promise<WsAckPayload> {
    const parsed = updateSchema.safeParse(raw)
    if (!parsed.success) return invalid
    const bytes = decode(parsed.data.update)
    if (bytes.length > MAX_UPDATE_BYTES) return { code: REJECTED, ok: false }
    try {
      await this.drafts.importCrdt(
        parsed.data.draftId,
        bytes,
        member.connectionId,
      )
      return { ok: true }
    } catch (error) {
      return this.failure(error)
    }
  }

  async presence(member: CollabMember, raw: unknown): Promise<WsAckPayload> {
    const parsed = presenceSchema.safeParse(raw)
    if (!parsed.success) return invalid
    const documentId = this.joined
      .get(member.connectionId)
      ?.get(parsed.data.draftId)
    if (!documentId) return { code: 'NOT_JOINED', ok: false }
    this.relay.publish(
      CollabWsEvents.presence,
      { documentId, state: parsed.data.state },
      roomOf(documentId),
      member.connectionId,
    )
    return { ok: true }
  }

  async leave(member: CollabMember, raw: unknown): Promise<WsAckPayload> {
    const parsed = leaveSchema.safeParse(raw)
    if (!parsed.success) return invalid
    const rooms = this.joined.get(member.connectionId)
    const documentId = rooms?.get(parsed.data.draftId)
    if (!rooms || !documentId) return { ok: true }
    rooms.delete(parsed.data.draftId)
    if (!rooms.size) this.joined.delete(member.connectionId)
    await member.leave(roomOf(documentId))
    this.announceLeft(member.connectionId, documentId)
    return { ok: true }
  }

  disconnect(connectionId: string) {
    const rooms = this.joined.get(connectionId)
    if (!rooms) return
    this.joined.delete(connectionId)
    for (const documentId of new Set(rooms.values())) {
      this.announceLeft(connectionId, documentId)
    }
  }

  private relayChange(change: DocumentChange) {
    this.relay.publish(
      CollabWsEvents.update,
      { documentId: change.documentId, update: encode(change.update) },
      roomOf(change.documentId),
      change.origin,
    )
  }

  private announceLeft(connectionId: string, documentId: string) {
    this.relay.publish(
      CollabWsEvents.peerLeft,
      { connectionId, documentId },
      roomOf(documentId),
    )
  }

  private membership(connectionId: string) {
    let rooms = this.joined.get(connectionId)
    if (!rooms) {
      rooms = new Map()
      this.joined.set(connectionId, rooms)
    }
    return rooms
  }

  private failure(error: unknown): WsAckPayload {
    if (error instanceof AppException) return { code: error.code, ok: false }
    this.logger.warn(`collab request failed: ${(error as Error).message}`)
    return { code: 'INTERNAL_ERROR', ok: false }
  }
}
