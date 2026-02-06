import { Global, Module } from '@nestjs/common'
import { OwnerController } from './owner.controller'
import { OwnerService } from './owner.service'

@Global()
@Module({
  controllers: [OwnerController],
  providers: [OwnerService],
  exports: [OwnerService],
})
export class OwnerModule {}
