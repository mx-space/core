import { Module } from '@nestjs/common'

import { FileModule } from '../../file/file.module'
import { AiImageService } from './ai-image.service'

@Module({
  imports: [FileModule],
  providers: [AiImageService],
  exports: [AiImageService],
})
export class AiImageModule {}
