import { forwardRef, Module } from '@nestjs/common'

import { DraftModule } from '../draft/draft.module'
import { MembershipModule } from '../membership/membership.module'
import { NoteModule } from '../note/note.module'
import { TopicModule } from '../topic/topic.module'
import { AiController } from './ai.controller'
import { AiService } from './ai.service'
import { AiAgentController } from './ai-agent/ai-agent.controller'
import { AiAgentChatService } from './ai-agent/ai-agent-chat.service'
import { AiAgentConversationRepository } from './ai-agent/ai-agent-conversation.repository'
import { AiAgentConversationService } from './ai-agent/ai-agent-conversation.service'
import { AiImageController } from './ai-image/ai-image.controller'
import { AiImageService } from './ai-image/ai-image.service'
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
import { LexicalPartialTranslationBuilder } from './ai-translation/lexical-partial-translation.builder'
import { TranslationReviewerService } from './ai-translation/reviewer.service'
import { LexicalTranslationStrategy } from './ai-translation/strategies/lexical-translation.strategy'
import { MarkdownTranslationStrategy } from './ai-translation/strategies/markdown-translation.strategy'
import { TranslationConsistencyService } from './ai-translation/translation-consistency.service'
import { TranslationEntryController } from './ai-translation/translation-entry.controller'
import { TranslationEntryService } from './ai-translation/translation-entry.service'
import {
  LEXICAL_TRANSLATION_STRATEGY,
  MARKDOWN_TRANSLATION_STRATEGY,
} from './ai-translation/translation-strategy.interface'
import { AiTtsController } from './ai-tts/ai-tts.controller'
import { AiTtsRepository } from './ai-tts/ai-tts.repository'
import { AiTtsService } from './ai-tts/ai-tts.service'
import { AiTtsQueryService } from './ai-tts/ai-tts-query.service'
import { AiSlugBackfillService } from './ai-writer/ai-slug-backfill.service'
import { AiWriterController } from './ai-writer/ai-writer.controller'
import { AiWriterService } from './ai-writer/ai-writer.service'

@Module({
  imports: [
    AiTaskModule,
    TopicModule,
    DraftModule,
    MembershipModule,
    forwardRef(() => NoteModule),
  ],
  providers: [
    AiSummaryService,
    AiSummaryRepository,
    AiInsightsService,
    AiInsightsRepository,
    AiInsightsTranslationService,
    AiInFlightService,
    AiService,
    AiImageService,
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
    TranslationReviewerService,
    LexicalPartialTranslationBuilder,
    AiTranslationService,
    AiTranslationRepository,
    TranslationEntryRepository,
    AiTranslationEventHandlerService,
    TranslationEntryService,
    AiAgentChatService,
    AiAgentConversationService,
    AiAgentConversationRepository,
    AiTtsService,
    AiTtsRepository,
    AiTtsQueryService,
  ],
  controllers: [
    AiController,
    AiImageController,
    AiSummaryController,
    AiInsightsController,
    AiWriterController,
    AiTranslationController,
    TranslationEntryController,
    AiAgentController,
    AiTtsController,
  ],
  exports: [
    AiService,
    AiWriterService,
    AiSlugBackfillService,
    AiTranslationService,
    AiTranslationRepository,
    AiSummaryService,
    AiInsightsService,
    TranslationEntryService,
    AiTtsService,
    AiTtsQueryService,
  ],
})
export class AiModule {}
