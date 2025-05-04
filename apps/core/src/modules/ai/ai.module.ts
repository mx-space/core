import { forwardRef, Module } from '@nestjs/common'

import { AiAgentModule } from './ai-agent/ai-agent.module'
import { AiSummaryController } from './ai-summary/ai-summary.controller'
import { AiSummaryService } from './ai-summary/ai-summary.service'
import { AiWriterController } from './ai-writer/ai-writer.controller'
import { AiWriterService } from './ai-writer/ai-writer.service'
import { AiService } from './ai.service'

@Module({
  imports: [forwardRef(() => AiAgentModule)],
  providers: [AiSummaryService, AiService, AiWriterService],
  controllers: [AiSummaryController, AiWriterController],
  exports: [AiService],
})
export class AiModule {}
