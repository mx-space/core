import { Global, Module } from '@nestjs/common'

import { ReaderRepository } from '../reader/reader.repository'
import { OwnerController } from './owner.controller'
import { OwnerRepository } from './owner.repository'
import { OwnerService } from './owner.service'

@Global()
@Module({
  controllers: [OwnerController],
  providers: [OwnerService, OwnerRepository, ReaderRepository],
  exports: [OwnerService, OwnerRepository],
})
export class OwnerModule {}
