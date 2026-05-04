import { Module } from '@nestjs/common'

import { OwnerModule } from '../owner/owner.module'
import { SubscribeController } from './subscribe.controller'
import { SubscribeRepository } from './subscribe.repository'
import { SubscribeService } from './subscribe.service'

@Module({
  controllers: [SubscribeController],
  providers: [SubscribeService, SubscribeRepository],
  exports: [SubscribeService, SubscribeRepository],
  imports: [OwnerModule],
})
export class SubscribeModule {}
