import { forwardRef, Module } from '@nestjs/common'

import { NoteModule } from '../note/note.module'
import { TopicModule } from '../topic/topic.module'
import { AiController } from './ai.controller'
import { AiService } from './ai.service'
import { AiAgentController } from './ai-agent/ai-agent.controller'
import { AiAgentChatService } from './ai-agent/ai-agent-chat.service'
import { AiAgentConversationRepository } from './ai-agent/ai-agent-conversation.repository'
import { AiAgentConversationService } from './ai-agent/ai-agent-conversation.service'
import { AiInFlightService } from './ai-inflight/ai-inflight.service'
import { AiInsightsController } from './ai-insights/ai-insights.controller'
import { AiInsightsRepository } from './ai-insights/ai-insights.repository'
import { AiInsightsService } from './ai-insights/ai-insights.service'
import { AiInsightsTranslationService } from './ai-insights/ai-insights-translation.service'
import { AiSummaryController } from './ai-summary/ai-summary.controller'
import { AiSummaryRepository } from './ai-summary/ai-summary.repository'
import { AiSummaryService } from './ai-summary/ai-summary.service'
import { AiTaskModule } from './ai-task/ai-task.module'
import { AiTranslationController } from './ai-translation/ai-translation.controller'
import {
  AiTranslationRepository,
  TranslationEntryRepository,
} from './ai-translation/ai-translation.repository'
import { AiTranslationService } from './ai-translation/ai-translation.service'
import { AiTranslationEventHandlerService } from './ai-translation/ai-translation-event-handler.service'
import { LexicalTranslationStrategy } from './ai-translation/strategies/lexical-translation.strategy'
import { MarkdownTranslationStrategy } from './ai-translation/strategies/markdown-translation.strategy'
import { TranslationConsistencyService } from './ai-translation/translation-consistency.service'
import { TranslationEntryController } from './ai-translation/translation-entry.controller'
import { TranslationEntryService } from './ai-translation/translation-entry.service'
import {
  LEXICAL_TRANSLATION_STRATEGY,
  MARKDOWN_TRANSLATION_STRATEGY,
} from './ai-translation/translation-strategy.interface'
import { AiSlugBackfillService } from './ai-writer/ai-slug-backfill.service'
import { AiWriterController } from './ai-writer/ai-writer.controller'
import { AiWriterService } from './ai-writer/ai-writer.service'

@Module({
  imports: [AiTaskModule, TopicModule, forwardRef(() => NoteModule)],
  providers: [
    AiSummaryService,
    AiSummaryRepository,
    AiInsightsService,
    AiInsightsRepository,
    AiInsightsTranslationService,
    AiInFlightService,
    AiService,
    AiWriterService,
    AiSlugBackfillService,
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
    AiTranslationRepository,
    TranslationEntryRepository,
    AiTranslationEventHandlerService,
    TranslationEntryService,
    AiAgentChatService,
    AiAgentConversationService,
    AiAgentConversationRepository,
  ],
  controllers: [
    AiController,
    AiSummaryController,
    AiInsightsController,
    AiWriterController,
    AiTranslationController,
    TranslationEntryController,
    AiAgentController,
  ],
  exports: [
    AiService,
    AiWriterService,
    AiSlugBackfillService,
    AiTranslationService,
    AiSummaryService,
    AiInsightsService,
    TranslationEntryService,
  ],
})
export class AiModule {}
