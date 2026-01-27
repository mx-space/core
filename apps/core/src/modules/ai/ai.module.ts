import { Module } from '@nestjs/common'
import { AiSummaryController } from './ai-summary/ai-summary.controller'
import { AiSummaryService } from './ai-summary/ai-summary.service'
import { AiTranslationController } from './ai-translation/ai-translation.controller'
import { AiTranslationService } from './ai-translation/ai-translation.service'
import { AiWriterController } from './ai-writer/ai-writer.controller'
import { AiWriterService } from './ai-writer/ai-writer.service'
import { AiController } from './ai.controller'
import { AiService } from './ai.service'

@Module({
  providers: [
    AiSummaryService,
    AiService,
    AiWriterService,
    AiTranslationService,
  ],
  controllers: [
    AiController,
    AiSummaryController,
    AiWriterController,
    AiTranslationController,
  ],
  exports: [AiService, AiTranslationService],
})
export class AiModule {}
