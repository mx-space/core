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
import { WsBusService } from '~/processors/gateway/ws/ws-bus.service'

import {
  COLLAB_RELAY,
  type CollabMember,
  type CollabRelay,
  CollabRoomService,
  CollabWsEvents,
} from './collab-room.service'

export const collabRelayProvider: Provider = {
  inject: [WsBusService],
  provide: COLLAB_RELAY,
  useFactory: (bus: WsBusService): CollabRelay => ({
    publish: (event, payload, room, exclude) =>
      bus.publish({
        event,
        exclude: exclude ? [exclude] : undefined,
        ns: 'admin',
        payload,
        rooms: [room],
      }),
  }),
}

const memberOf = (ctx: AdminWsContext): CollabMember => ({
  connectionId: ctx.connectionId,
  join: ctx.join,
  leave: ctx.leave,
})

@Injectable()
export class CollabRoomWsHandler implements OnModuleInit, OnModuleDestroy {
  private readonly disposers: Array<() => void> = []

  constructor(
    private readonly registry: AdminWsHandlerRegistry,
    private readonly rooms: CollabRoomService,
  ) {}

  onModuleInit() {
    this.disposers.push(
      this.registry.register(CollabWsEvents.join, (ctx, payload) =>
        this.rooms.join(memberOf(ctx), payload),
      ),
      this.registry.register(CollabWsEvents.update, (ctx, payload) =>
        this.rooms.update(memberOf(ctx), payload),
      ),
      this.registry.register(CollabWsEvents.presence, (ctx, payload) =>
        this.rooms.presence(memberOf(ctx), payload),
      ),
      this.registry.register(CollabWsEvents.leave, (ctx, payload) =>
        this.rooms.leave(memberOf(ctx), payload),
      ),
      this.registry.onDisconnect((connectionId) =>
        this.rooms.disconnect(connectionId),
      ),
    )
  }

  onModuleDestroy() {
    for (const dispose of this.disposers.splice(0)) dispose()
  }
}
