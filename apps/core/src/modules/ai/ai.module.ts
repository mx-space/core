import { Module } from '@nestjs/common'

import { AiController } from './ai.controller'
import { AiService } from './ai.service'

@Module({
  providers: [AiService],
  controllers: [AiController],
})
export class AiModule {}
