import { forwardRef, Module } from '@nestjs/common'

import { SnippetModule } from '../snippet/snippet.module'
import { ServerlessController } from './serverless.controller'
import {
  ServerlessLogRepository,
  ServerlessStorageRepository,
} from './serverless.repository'
import { ServerlessService } from './serverless.service'

@Module({
  imports: [forwardRef(() => SnippetModule)],
  controllers: [ServerlessController],
  providers: [
    ServerlessService,
    ServerlessStorageRepository,
    ServerlessLogRepository,
  ],
  exports: [ServerlessService],
})
export class ServerlessModule {}
