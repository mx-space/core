import { forwardRef, Module } from '@nestjs/common'

import { OwnerModule } from '../owner/owner.module'
import { ReaderModule } from '../reader/reader.module'
import { SnippetModule } from '../snippet/snippet.module'
import { ServerlessController } from './serverless.controller'
import {
  ServerlessLogRepository,
  ServerlessStorageRepository,
} from './serverless.repository'
import { ServerlessService } from './serverless.service'

@Module({
  imports: [forwardRef(() => SnippetModule), OwnerModule, ReaderModule],
  controllers: [ServerlessController],
  providers: [
    ServerlessService,
    ServerlessStorageRepository,
    ServerlessLogRepository,
  ],
  exports: [ServerlessService],
})
export class ServerlessModule {}
