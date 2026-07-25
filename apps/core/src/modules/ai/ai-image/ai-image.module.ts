import { Module } from '@nestjs/common'

import { AiImageService } from './ai-image.service'

@Module({
  providers: [AiImageService],
  exports: [AiImageService],
})
export class AiImageModule {}
