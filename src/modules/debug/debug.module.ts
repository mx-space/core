import { Module } from '@nestjs/common'
import { ServerlessModule } from '../serverless/serverless.module'
import { DebugController } from './debug.controller'

@Module({
  controllers: [DebugController],
  imports: [ServerlessModule],
})
export class DebugModule {}
