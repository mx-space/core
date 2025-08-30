import { Module } from '@nestjs/common'
import { MarkdownModule } from '../markdown/markdown.module'
import { RenderEjsController } from './render.controller'

@Module({
  controllers: [RenderEjsController],
  imports: [MarkdownModule],
})
export class RenderEjsModule {}
