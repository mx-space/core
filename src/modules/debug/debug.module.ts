import { Module } from '@nestjs/common'
import { DebugController } from './debug.controller'

@Module({
  controllers: [DebugController],
})
export class DebugModule {}
