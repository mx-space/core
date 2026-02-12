import { Global, Module } from '@nestjs/common'
import { FileReferenceService } from './file-reference.service'
import { FileController } from './file.controller'
import { FileService } from './file.service'

@Global()
@Module({
  controllers: [FileController],
  providers: [FileService, FileReferenceService],
  exports: [FileService, FileReferenceService],
})
export class FileModule {}
