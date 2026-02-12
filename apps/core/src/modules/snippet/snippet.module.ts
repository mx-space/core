import { forwardRef, Module } from '@nestjs/common'
import { ServerlessModule } from '../serverless/serverless.module'
import { SnippetRouteController } from './snippet-route.controller'
import { SnippetController } from './snippet.controller'
import { SnippetService } from './snippet.service'

@Module({
  controllers: [SnippetController, SnippetRouteController],
  exports: [SnippetService],
  providers: [SnippetService],
  imports: [forwardRef(() => ServerlessModule)],
})
export class SnippetModule {}
