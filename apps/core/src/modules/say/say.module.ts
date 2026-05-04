import { Module } from '@nestjs/common'

import { SayController } from './say.controller'
import { SayRepository } from './say.repository'
import { SayService } from './say.service'

@Module({
  controllers: [SayController],
  providers: [SayService, SayRepository],
  exports: [SayService, SayRepository],
})
export class SayModule {}
