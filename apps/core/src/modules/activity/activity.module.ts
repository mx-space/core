import { Module } from '@nestjs/common'

import { GatewayModule } from '~/processors/gateway/gateway.module'

import { ActivityController } from './activity.controller'
import { ActivityService } from './activity.service'

@Module({
  providers: [ActivityService],
  controllers: [ActivityController],
  exports: [ActivityService],
  imports: [GatewayModule],
})
export class ActivityModule {}
