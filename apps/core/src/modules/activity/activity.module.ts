import { Module } from '@nestjs/common'

import { GatewayService } from '~/processors/gateway/gateway.service'
import { WebEventsGateway } from '~/processors/gateway/web/events.gateway'

import { ActivityController } from './activity.controller'
import { ActivityService } from './activity.service'

@Module({
  providers: [ActivityService, GatewayService],
  controllers: [ActivityController],
  exports: [ActivityService],
  imports: [WebEventsGateway],
})
export class ActivityModule {}
