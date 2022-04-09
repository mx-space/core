/*
 * @Author: Innei
 * @Date: 2020-04-30 12:21:51
 * @LastEditTime: 2020-05-31 19:07:17
 * @LastEditors: Innei
 * @FilePath: /mx-server/src/gateway/gateway.module.ts
 * @Coding with Love
 */
import { Global, Module } from '@nestjs/common'

import { AuthModule } from '../../modules/auth/auth.module'
import { AdminEventsGateway } from './admin/events.gateway'
import { SharedGateway } from './shared/events.gateway'
import { SystemEventsGateway } from './system/events.gateway'
import { WebEventsGateway } from './web/events.gateway'

@Global()
@Module({
  imports: [AuthModule],
  providers: [
    AdminEventsGateway,
    WebEventsGateway,
    SharedGateway,
    SystemEventsGateway,
  ],
  exports: [
    AdminEventsGateway,
    WebEventsGateway,
    SharedGateway,
    SystemEventsGateway,
  ],
})
export class GatewayModule {}
