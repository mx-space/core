import { Module } from '@nestjs/common'
import { ServerlessController } from './serverless.controller'
import { ServerlessService } from './serverless.service'

@Module({
  controllers: [ServerlessController],
  providers: [ServerlessService],
  exports: [ServerlessService],
})
export class ServerlessModule {}
