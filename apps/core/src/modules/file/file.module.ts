import { Module } from '@nestjs/common'
import { ServerlessModule } from '../serverless/serverless.module'
import { FileController } from './file.controller'
import { FileService } from './file.service'

@Module({
  imports: [ServerlessModule],
  controllers: [FileController],
  providers: [FileService],
  exports: [FileService],
})
export class FileModule {}
