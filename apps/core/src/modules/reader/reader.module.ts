import { Module } from '@nestjs/common'

import { ReaderAuthController } from './reader.controller'
import { ReaderRepository } from './reader.repository'
import { ReaderService } from './reader.service'

@Module({
  controllers: [ReaderAuthController],
  providers: [ReaderService, ReaderRepository],
  exports: [ReaderService, ReaderRepository],
})
export class ReaderModule {}
