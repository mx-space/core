import { Module } from '@nestjs/common'
import { ReaderAuthController } from './reader.controller'
import { ReaderService } from './reader.service'

@Module({
  controllers: [ReaderAuthController],
  providers: [ReaderService],
  exports: [ReaderService],
})
export class ReaderModule {}
