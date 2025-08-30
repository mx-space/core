import { Module } from '@nestjs/common'
import { SayController } from './say.controller'
import { SayService } from './say.service'

@Module({
  controllers: [SayController],
  providers: [SayService],
  exports: [SayService],
})
export class SayModule {}
