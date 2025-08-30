import { Module } from '@nestjs/common'
import { ServerlessModule } from '../serverless/serverless.module'
import { DebugController } from './debug.controller'
import { DebugService } from './debug.service'

@Module({
  controllers: [DebugController],
  imports: [ServerlessModule],
  providers: [DebugService],
})
export class DebugModule {}
