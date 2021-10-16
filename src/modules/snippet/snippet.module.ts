/**
 * 数据配置区块
 */
import { Module } from '@nestjs/common'
import { SnippetController } from './snippet.controller'
import { SnippetService } from './snippet.service'

@Module({
  controllers: [SnippetController],
  exports: [SnippetService],
  providers: [SnippetService],
})
export class SnippetModule {}
