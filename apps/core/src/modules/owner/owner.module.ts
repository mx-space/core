import { Global, Module } from '@nestjs/common'

import { ReaderModule } from '../reader/reader.module'
import { OwnerController } from './owner.controller'
import { OwnerRepository } from './owner.repository'
import { OwnerService } from './owner.service'

@Global()
@Module({
  imports: [ReaderModule],
  controllers: [OwnerController],
  providers: [OwnerService, OwnerRepository],
  exports: [OwnerService, OwnerRepository],
})
export class OwnerModule {}
