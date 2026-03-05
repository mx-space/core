import { Module } from '@nestjs/common'

import { AiController } from './ai.controller'
import { AiService } from './ai.service'
import { AiInFlightService } from './ai-inflight/ai-inflight.service'
import { AiSummaryController } from './ai-summary/ai-summary.controller'
import { AiSummaryService } from './ai-summary/ai-summary.service'
import { AiTaskModule } from './ai-task/ai-task.module'
import { AiTranslationController } from './ai-translation/ai-translation.controller'
import { AiTranslationService } from './ai-translation/ai-translation.service'
import { AiTranslationEventHandlerService } from './ai-translation/ai-translation-event-handler.service'
import { LexicalTranslationStrategy } from './ai-translation/strategies/lexical-translation.strategy'
import { MarkdownTranslationStrategy } from './ai-translation/strategies/markdown-translation.strategy'
import { TranslationConsistencyService } from './ai-translation/translation-consistency.service'
import {
  LEXICAL_TRANSLATION_STRATEGY,
  MARKDOWN_TRANSLATION_STRATEGY,
} from './ai-translation/translation-strategy.interface'
import { AiWriterController } from './ai-writer/ai-writer.controller'
import { AiWriterService } from './ai-writer/ai-writer.service'

@Module({
  imports: [AiTaskModule],
  providers: [
    AiSummaryService,
    AiInFlightService,
    AiService,
    AiWriterService,
    {
      provide: LEXICAL_TRANSLATION_STRATEGY,
      useClass: LexicalTranslationStrategy,
    },
    {
      provide: MARKDOWN_TRANSLATION_STRATEGY,
      useClass: MarkdownTranslationStrategy,
    },
    TranslationConsistencyService,
    AiTranslationService,
    AiTranslationEventHandlerService,
  ],
  controllers: [
    AiController,
    AiSummaryController,
    AiWriterController,
    AiTranslationController,
  ],
  exports: [AiService, AiTranslationService, AiSummaryService],
})
export class AiModule {}
