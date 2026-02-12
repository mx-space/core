import { Module } from '@nestjs/common'
import { OwnerModule } from '../owner/owner.module'
import { SubscribeController } from './subscribe.controller'
import { SubscribeService } from './subscribe.service'

@Module({
  controllers: [SubscribeController],
  providers: [SubscribeService],
  exports: [SubscribeService],
  imports: [OwnerModule],
})
export class SubscribeModule {}
