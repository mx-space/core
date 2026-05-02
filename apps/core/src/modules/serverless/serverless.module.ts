import { forwardRef, Module } from '@nestjs/common'

import { OwnerRepository } from '../owner/owner.repository'
import { ReaderRepository } from '../reader/reader.repository'
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
    ReaderRepository,
    OwnerRepository,
    ServerlessStorageRepository,
    ServerlessLogRepository,
  ],
  exports: [ServerlessService],
})
export class ServerlessModule {}
