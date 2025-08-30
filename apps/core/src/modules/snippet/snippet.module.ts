/**
 * 数据配置区块
 */
import { forwardRef, Module } from '@nestjs/common'
import { ServerlessModule } from '../serverless/serverless.module'
import { SnippetController } from './snippet.controller'
import { SnippetService } from './snippet.service'

@Module({
  controllers: [SnippetController],
  exports: [SnippetService],
  providers: [SnippetService],
  imports: [forwardRef(() => ServerlessModule)],
})
export class SnippetModule {}
