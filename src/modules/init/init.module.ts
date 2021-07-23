import { Module } from '@nestjs/common'
import { InitService } from './init.service'

@Module({
  providers: [InitService],
  exports: [InitService],
})
export class InitModule {}
