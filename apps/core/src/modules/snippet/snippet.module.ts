import { forwardRef, Module } from '@nestjs/common'

import { ServerlessModule } from '../serverless/serverless.module'
import { SnippetController } from './snippet.controller'
import { SnippetRepository } from './snippet.repository'
import { SnippetService } from './snippet.service'
import { SnippetRouteController } from './snippet-route.controller'

@Module({
  controllers: [SnippetController, SnippetRouteController],
  exports: [SnippetService, SnippetRepository],
  providers: [SnippetService, SnippetRepository],
  imports: [forwardRef(() => ServerlessModule)],
})
export class SnippetModule {}
