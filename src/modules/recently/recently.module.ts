import { Module } from '@nestjs/common'

import { RecentlyController } from './recently.controller'
import { RecentlyService } from './recently.service'

@Module({
  controllers: [RecentlyController],
  providers: [RecentlyService],
  exports: [RecentlyService],
})
export class RecentlyModule {}
