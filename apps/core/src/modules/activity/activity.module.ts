import { Module } from '@nestjs/common'

import { GatewayModule } from '~/processors/gateway/gateway.module'

import { CommentModule } from '../comment/comment.module'
import { ActivityController } from './activity.controller'
import { ActivityService } from './activity.service'

@Module({
  providers: [ActivityService],
  controllers: [ActivityController],
  exports: [ActivityService],
  imports: [GatewayModule, CommentModule],
})
export class ActivityModule {}
