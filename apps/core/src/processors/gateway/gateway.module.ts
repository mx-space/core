/*
 * @Author: Innei
 * @Date: 2020-04-30 12:21:51
 * @LastEditTime: 2020-05-31 19:07:17
 * @LastEditors: Innei
 * @FilePath: /mx-server/src/gateway/gateway.module.ts
 * @Coding with Love
 */
import { Global, Module } from '@nestjs/common'

import { AdminEventsGateway } from './admin/events.gateway'
import { GatewayService } from './gateway.service'
import { SharedGateway } from './shared/events.gateway'
import { WebEventsGateway } from './web/events.gateway'
import { VisitorEventDispatchService } from './web/visitor-event-dispatch.service'
import { WsBusService } from './ws/ws-bus.service'
import { WsPresenceService } from './ws/ws-presence.service'

@Global()
@Module({
  imports: [],
  providers: [
    AdminEventsGateway,
    WebEventsGateway,
    SharedGateway,

    GatewayService,

    VisitorEventDispatchService,

    WsBusService,
    WsPresenceService,
  ],
  exports: [
    AdminEventsGateway,
    WebEventsGateway,
    SharedGateway,

    GatewayService,

    WsBusService,
    WsPresenceService,
  ],
})
export class GatewayModule {}
