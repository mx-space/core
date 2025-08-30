import { Module } from '@nestjs/common'
import { UserModule } from '../user/user.module'
import { SubscribeController } from './subscribe.controller'
import { SubscribeService } from './subscribe.service'

@Module({
  controllers: [SubscribeController],
  providers: [SubscribeService],
  exports: [SubscribeService],
  imports: [UserModule],
})
export class SubscribeModule {}
