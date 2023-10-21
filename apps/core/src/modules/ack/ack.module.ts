import { Module } from '@nestjs/common'
import { DiscoveryModule } from '@nestjs/core'

import { AckController } from './ack.controller'

@Module({
  controllers: [AckController],
  imports: [DiscoveryModule],
})
export class AckModule {}
