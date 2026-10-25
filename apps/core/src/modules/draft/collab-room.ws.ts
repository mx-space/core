import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
  type Provider,
} from '@nestjs/common'

import {
  type AdminWsContext,
  AdminWsHandlerRegistry,
} from '~/processors/gateway/admin/admin-ws-handler.registry'
import {
  type WebWsContext,
  WebWsHandlerRegistry,
} from '~/processors/gateway/web/web-ws-handler.registry'
import { WsBusService } from '~/processors/gateway/ws/ws-bus.service'

import { CollabRepository } from './collab.repository'
import { CollabService } from './collab.service'
import {
  COLLAB_ACCESS,
  COLLAB_RELAY,
  type CollabAccess,
  type CollabDropReason,
  type CollabIdentity,
  type CollabMember,
  type CollabRelay,
  CollabRoomService,
  CollabWsEvents,
} from './collab-room.service'

const DROP_EVENT = 'collab.drop'
const DROP_REASONS = new Set<CollabDropReason>([
  'compacted',
  'deleted',
  'removed',
])

const isDropReason = (value: unknown): value is CollabDropReason =>
  DROP_REASONS.has(value as CollabDropReason)

export const collabRelayProvider: Provider = {
  inject: [WsBusService],
  provide: COLLAB_RELAY,
  useFactory: (bus: WsBusService): CollabRelay => ({
    drop: (documentId, scope) =>
      bus.publish({
        event: DROP_EVENT,
        ns: 'collab',
        payload: { documentId, ...scope },
      }),
    onDrop: (listener) =>
      bus.register('collab', (frame) => {
        if (frame.event !== DROP_EVENT) return
        const payload = frame.payload as
          | { documentId?: string; readerId?: string; reason?: string }
          | undefined
        if (!payload?.documentId || !isDropReason(payload.reason)) return
        listener(payload.documentId, {
          readerId: payload.readerId,
          reason: payload.reason,
        })
      }),
    publish: (event, payload, room, exclude) => {
      for (const ns of ['admin', 'web'] as const) {
        bus.publish({
          event,
          exclude: exclude ? [exclude] : undefined,
          ns,
          payload,
          rooms: [room],
        })
      }
    },
  }),
}

export const collabAccessProvider: Provider = {
  inject: [CollabRepository],
  provide: COLLAB_ACCESS,
  useFactory: (repository: CollabRepository): CollabAccess => ({
    canJoin: async (member, documentId) =>
      member.identity.kind === 'owner' ||
      repository.isCollaborator(documentId, member.identity.readerId),
    recordContribution: (documentId, readerId) =>
      repository.markContributed(documentId, readerId),
  }),
}

const memberOf = (
  ctx: AdminWsContext | WebWsContext,
  identity: CollabIdentity,
): CollabMember => ({
  alive: ctx.alive,
  connectionId: ctx.connectionId,
  identity,
  join: ctx.join,
  leave: ctx.leave,
  send: ctx.send,
})

const unauthenticated = { code: 'NOT_AUTHENTICATED', ok: false } as const

type RoomHandler = (
  room: CollabRoomService,
  member: CollabMember,
  payload: unknown,
) => ReturnType<CollabRoomService['join']>

const ROOM_HANDLERS: Array<[string, RoomHandler]> = [
  [CollabWsEvents.join, (room, member, payload) => room.join(member, payload)],
  [
    CollabWsEvents.update,
    (room, member, payload) => room.update(member, payload),
  ],
  [
    CollabWsEvents.presence,
    (room, member, payload) => room.presence(member, payload),
  ],
  [
    CollabWsEvents.leave,
    (room, member, payload) => room.leave(member, payload),
  ],
]

@Injectable()
export class CollabRoomWsHandler implements OnModuleInit, OnModuleDestroy {
  private readonly disposers: Array<() => void> = []

  constructor(
    private readonly adminRegistry: AdminWsHandlerRegistry,
    private readonly webRegistry: WebWsHandlerRegistry,
    private readonly rooms: CollabRoomService,
    private readonly collab: CollabService,
  ) {}

  onModuleInit() {
    for (const [event, handle] of ROOM_HANDLERS) {
      this.disposers.push(
        this.adminRegistry.register(event, async (ctx, payload) => {
          const identity = await this.collab.ownerIdentity()
          if (!identity) return unauthenticated
          return handle(this.rooms, memberOf(ctx, identity), payload)
        }),
        this.webRegistry.register(event, async (ctx, payload) => {
          const identity = ctx.readerId
            ? await this.collab.identityOf(ctx.readerId)
            : null
          if (!identity) return unauthenticated
          return handle(this.rooms, memberOf(ctx, identity), payload)
        }),
      )
    }
    for (const registry of [this.adminRegistry, this.webRegistry]) {
      this.disposers.push(
        registry.onDisconnect((connectionId) =>
          this.rooms.disconnect(connectionId),
        ),
      )
    }
  }

  onModuleDestroy() {
    for (const dispose of this.disposers.splice(0)) dispose()
  }
}
