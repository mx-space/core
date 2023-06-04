import { Module } from '@nestjs/common'

import { UserService } from '../user/user.service'
import { SubscribeController } from './subscribe.controller'
import { SubscribeService } from './subscribe.service'

@Module({
  controllers: [SubscribeController],
  providers: [SubscribeService, UserService],
  exports: [SubscribeService],
})
export class SubscribeModule {}
