import { forwardRef, Module } from '@nestjs/common'

import { SnippetModule } from '../snippet/snippet.module'
import { ServerlessController } from './serverless.controller'
import { ServerlessService } from './serverless.service'

@Module({
  imports: [forwardRef(() => SnippetModule)],
  controllers: [ServerlessController],
  providers: [ServerlessService],
  exports: [ServerlessService],
})
export class ServerlessModule {}
