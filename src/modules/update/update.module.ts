import { Module } from '@nestjs/common'

import { UpdateController } from './update.controller'
import { UpdateService } from './update.service'

@Module({
  controllers: [UpdateController],
  providers: [UpdateService],
})
export class UpdateModule {}
