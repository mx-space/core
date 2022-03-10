import { Module } from '@nestjs/common'
import { SnippetModule } from '../snippet/snippet.module'
import { DebugController } from './debug.controller'

@Module({
  controllers: [DebugController],
  imports: [SnippetModule],
})
export class DebugModule {}
