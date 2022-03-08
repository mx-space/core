import { Module } from '@nestjs/common'
import { SnippetService } from '../snippet/snippet.service'
import { DebugController } from './debug.controller'

@Module({
  controllers: [DebugController],
  providers: [SnippetService],
})
export class DebugModule {}
