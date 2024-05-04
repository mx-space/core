import { Module } from '@nestjs/common'

import { AiSummaryController } from './ai-summary/ai-summary.controller'
import { AiSummaryService } from './ai-summary/ai-summary.service'
import { AiService } from './ai.service'
import { AiWriterService } from './ai-writer/ai-writer.service'
import { AiWriterController } from './ai-writer/ai-writer.controller'

@Module({
  providers: [AiSummaryService, AiService, AiWriterService],
  controllers: [AiSummaryController, AiWriterController],
  exports: [AiService],
})
export class AiModule {}
