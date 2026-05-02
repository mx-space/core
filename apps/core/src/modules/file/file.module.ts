import { Global, Module } from '@nestjs/common'

import { FileController } from './file.controller'
import { FileService } from './file.service'
import { FileReferenceRepository } from './file-reference.repository'
import { FileReferenceService } from './file-reference.service'

@Global()
@Module({
  controllers: [FileController],
  providers: [FileService, FileReferenceService, FileReferenceRepository],
  exports: [FileService, FileReferenceService],
})
export class FileModule {}
