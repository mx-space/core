import { Module } from '@nestjs/common'

import { PushController } from './push.controller'
import { PushRepository } from './push.repository'
import { PushService } from './push.service'

@Module({
  controllers: [PushController],
  providers: [PushRepository, PushService],
})
export class PushModule {}
