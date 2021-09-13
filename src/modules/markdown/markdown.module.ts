import { Module } from '@nestjs/common'
import { MarkdownController } from './markdown.controller'
import { MarkdownService } from './markdown.service'

@Module({
  controllers: [MarkdownController],
  providers: [MarkdownService],
  exports: [MarkdownService],
})
export class MarkdownModule {}
