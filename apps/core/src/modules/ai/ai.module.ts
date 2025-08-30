import { forwardRef, Module } from '@nestjs/common'
import { McpModule } from '../mcp/mcp.module'
import { AiSummaryController } from './ai-summary/ai-summary.controller'
import { AiSummaryService } from './ai-summary/ai-summary.service'
import { AiWriterController } from './ai-writer/ai-writer.controller'
import { AiWriterService } from './ai-writer/ai-writer.service'
import { AiService } from './ai.service'

@Module({
  imports: [forwardRef(() => McpModule)],
  providers: [AiSummaryService, AiService, AiWriterService],
  controllers: [AiSummaryController, AiWriterController],
  exports: [AiService],
})
export class AiModule {}
