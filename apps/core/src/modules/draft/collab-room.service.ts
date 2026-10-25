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
  revoked: 'collab.revoked',
  update: 'collab.update',
} as const

export const COLLAB_RELAY = Symbol('COLLAB_RELAY')
export const COLLAB_ACCESS = Symbol('COLLAB_ACCESS')

export interface CollabAccess {
  canJoin: (member: CollabMember, documentId: string) => Promise<boolean>
  recordContribution: (documentId: string, readerId: string) => Promise<void>
}

export interface CollabRelay {
  onRevoke: (
    listener: (documentId: string, readerId: string) => void,
  ) => () => void
  publish: (
    event: string,
    payload: unknown,
    room: string,
    exclude?: string,
  ) => void
  revoke: (documentId: string, readerId: string) => void
}

export interface PresenceUser {
  avatar: string | null
  id: string
  name: string
}

export type CollabIdentity =
  | { kind: 'owner'; user: PresenceUser }
  | { kind: 'reader'; readerId: string; user: PresenceUser }

export interface CollabMember {
  alive: () => boolean
  connectionId: string
  identity: CollabIdentity
  join: (room: string) => Promise<void>
  leave: (room: string) => Promise<void>
  send: (event: string, payload: unknown) => void
}

interface Joined {
  contributed: boolean
  documentId: string
  member: CollabMember
}

interface Bucket {
  at: number
  tokens: number
}

const MAX_UPDATE_BYTES = 4 * 1024 * 1024
const MAX_CARET_CHARS = 4096
const BUCKET_SIZE = 120
const BUCKET_REFILL_PER_MS = 60 / 1000
const REJECTED = 'DRAFT_CRDT_UPDATE_REJECTED'

const base64 = z.string().max(Math.ceil((MAX_UPDATE_BYTES * 4) / 3) + 8)
const draftId = z.string().min(1).max(64)
const joinSchema = z.object({ draftId, since: base64.optional() })
const updateSchema = z.object({ draftId, update: z.string() })
const presenceSchema = z.object({
  caret: z.unknown(),
  draftId,
  entry: z
    .string()
    .regex(/^agent:\w{1,40}$/)
    .optional(),
})
const leaveSchema = z.object({ draftId })

const roomOf = (documentId: string) => `collab:${documentId}`
const encode = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')
const decode = (value: string) => new Uint8Array(Buffer.from(value, 'base64'))

const invalid: WsAckPayload = { code: 'VALIDATION_FAILED', ok: false }
const rateLimited: WsAckPayload = { code: 'RATE_LIMITED', ok: false }
const notJoined: WsAckPayload = { code: 'NOT_JOINED', ok: false }

const authorOf = (identity: CollabIdentity) =>
  identity.kind === 'reader' ? `human:${identity.readerId}` : undefined

@Injectable()
export class CollabRoomService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CollabRoomService.name)
  private readonly joined = new Map<string, Map<string, Joined>>()
  private readonly buckets = new Map<string, Bucket>()
  private stopListening: Array<() => void> = []

  constructor(
    private readonly drafts: DraftService,
    private readonly crdt: DraftCrdtService,
    @Inject(COLLAB_RELAY) private readonly relay: CollabRelay,
    @Inject(COLLAB_ACCESS) private readonly access: CollabAccess,
  ) {}

  onModuleInit() {
    this.stopListening = [
      this.crdt.onDocumentChanged((change) => this.relayChange(change)),
      this.relay.onRevoke((documentId, readerId) =>
        this.dropReader(documentId, readerId),
      ),
    ]
  }

  onModuleDestroy() {
    for (const stop of this.stopListening.splice(0)) stop()
  }

  revoke(documentId: string, readerId: string) {
    this.dropReader(documentId, readerId)
    this.relay.revoke(documentId, readerId)
  }

  async join(member: CollabMember, raw: unknown): Promise<WsAckPayload> {
    const parsed = joinSchema.safeParse(raw)
    if (!parsed.success) return invalid
    const { draftId, since } = parsed.data
    let room: string | null = null
    let entry: Joined | null = null
    const backOut = async (ack: WsAckPayload) => {
      this.forget(member.connectionId, draftId, entry)
      if (room) await member.leave(room).catch(() => undefined)
      return ack
    }
    try {
      const documentId = await this.drafts.documentIdOf(draftId)
      if (!(await this.access.canJoin(member, documentId))) {
        return { code: 'FORBIDDEN', ok: false }
      }
      // Registered before joining so a removal that lands mid-join finds and drops it.
      entry = { contributed: false, documentId, member }
      this.membership(member.connectionId).set(draftId, entry)
      room = roomOf(documentId)
      // Join before reading: a change stored after the read is then relayed to this member,
      // and one stored before it is in the snapshot. Loro dedupes anything seen twice.
      await member.join(room)
      if (!member.alive()) return backOut({ code: 'NOT_CONNECTED', ok: false })
      const { update } = await this.drafts.exportCrdtFor(
        draftId,
        since ? decode(since) : undefined,
      )
      if (!member.alive()) return backOut({ code: 'NOT_CONNECTED', ok: false })
      const stillJoined =
        this.joined.get(member.connectionId)?.get(draftId) === entry
      if (!stillJoined || !(await this.access.canJoin(member, documentId))) {
        return backOut({ code: 'FORBIDDEN', ok: false })
      }
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
      return backOut(this.failure(error))
    }
  }

  async update(member: CollabMember, raw: unknown): Promise<WsAckPayload> {
    const parsed = updateSchema.safeParse(raw)
    if (!parsed.success) return invalid
    const bytes = decode(parsed.data.update)
    if (bytes.length > MAX_UPDATE_BYTES) return { code: REJECTED, ok: false }
    const joined = this.joined
      .get(member.connectionId)
      ?.get(parsed.data.draftId)
    if (!joined) return notJoined
    if (!this.take(member)) return rateLimited
    try {
      await this.drafts.importCrdt(
        parsed.data.draftId,
        bytes,
        member.connectionId,
        authorOf(member.identity),
      )
      const { identity } = member
      if (identity.kind === 'reader' && !joined.contributed) {
        joined.contributed = true
        await this.access.recordContribution(
          joined.documentId,
          identity.readerId,
        )
      }
      return { ok: true }
    } catch (error) {
      return this.failure(error)
    }
  }

  async presence(member: CollabMember, raw: unknown): Promise<WsAckPayload> {
    const parsed = presenceSchema.safeParse(raw)
    if (!parsed.success) return invalid
    const { caret, draftId, entry } = parsed.data
    const caretChars = JSON.stringify(caret ?? null).length
    if (caretChars > MAX_CARET_CHARS) return invalid
    const joined = this.joined.get(member.connectionId)?.get(draftId)
    if (!joined) return notJoined
    if (entry && member.identity.kind !== 'owner') {
      return { code: 'FORBIDDEN', ok: false }
    }
    if (!this.take(member)) return rateLimited
    this.relay.publish(
      CollabWsEvents.presence,
      {
        caret: caret ?? null,
        connectionId: member.connectionId,
        documentId: joined.documentId,
        entry: entry ?? null,
        user: entry
          ? { avatar: null, id: entry, name: 'AI' }
          : member.identity.user,
      },
      roomOf(joined.documentId),
      member.connectionId,
    )
    return { ok: true }
  }

  async leave(member: CollabMember, raw: unknown): Promise<WsAckPayload> {
    const parsed = leaveSchema.safeParse(raw)
    if (!parsed.success) return invalid
    const rooms = this.joined.get(member.connectionId)
    const joined = rooms?.get(parsed.data.draftId)
    if (!rooms || !joined) return { ok: true }
    this.forget(member.connectionId, parsed.data.draftId)
    await member.leave(roomOf(joined.documentId))
    this.announceLeft(member.connectionId, joined.documentId)
    return { ok: true }
  }

  disconnect(connectionId: string) {
    const rooms = this.joined.get(connectionId)
    this.buckets.delete(connectionId)
    if (!rooms) return
    this.joined.delete(connectionId)
    for (const documentId of new Set(
      [...rooms.values()].map((joined) => joined.documentId),
    )) {
      this.announceLeft(connectionId, documentId)
    }
  }

  private dropReader(documentId: string, readerId: string) {
    for (const [connectionId, rooms] of this.joined) {
      for (const [draftId, joined] of rooms) {
        const { identity } = joined.member
        if (joined.documentId !== documentId) continue
        if (identity.kind !== 'reader' || identity.readerId !== readerId) {
          continue
        }
        this.forget(connectionId, draftId)
        void joined.member.leave(roomOf(documentId)).catch(() => undefined)
        joined.member.send(CollabWsEvents.revoked, { documentId })
        this.announceLeft(connectionId, documentId)
      }
    }
  }

  private forget(connectionId: string, draftId: string, only?: Joined | null) {
    const rooms = this.joined.get(connectionId)
    if (only !== undefined && rooms?.get(draftId) !== only) return
    rooms?.delete(draftId)
    if (rooms && !rooms.size) this.joined.delete(connectionId)
  }

  private take(member: CollabMember) {
    if (member.identity.kind === 'owner') return true
    const now = Date.now()
    const bucket = this.buckets.get(member.connectionId) ?? {
      at: now,
      tokens: BUCKET_SIZE,
    }
    bucket.tokens = Math.min(
      BUCKET_SIZE,
      bucket.tokens + (now - bucket.at) * BUCKET_REFILL_PER_MS,
    )
    bucket.at = now
    this.buckets.set(member.connectionId, bucket)
    if (bucket.tokens < 1) return false
    bucket.tokens -= 1
    return true
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
