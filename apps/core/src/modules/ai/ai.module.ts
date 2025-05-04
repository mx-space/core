import { Module } from '@nestjs/common'

import { AiSummaryController } from './ai-summary/ai-summary.controller'
import { AiSummaryService } from './ai-summary/ai-summary.service'
import { AiToolModule } from './ai-tool/ai-tool.module'
import { AiWriterController } from './ai-writer/ai-writer.controller'
import { AiWriterService } from './ai-writer/ai-writer.service'
import { AiService } from './ai.service'

@Module({
  imports: [AiToolModule],
  providers: [AiSummaryService, AiService, AiWriterService],
  controllers: [AiSummaryController, AiWriterController],
  exports: [AiService],
})
export class AiModule {}
