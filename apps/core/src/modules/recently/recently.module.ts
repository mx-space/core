import { forwardRef, Module } from '@nestjs/common'

import { AiEchoModule } from '../ai/ai-echo/ai-echo.module'
import { CommentModule } from '../comment/comment.module'
import { EnrichmentModule } from '../enrichment/enrichment.module'
import { RecentlyController } from './recently.controller'
import { RecentlyRepository } from './recently.repository'
import { RecentlyService } from './recently.service'
import {
  RecentlyEchoScenarioRegistrar,
  RecentlyEchoSubjectDeleteListener,
} from './scenarios/recently-echo.scenario'

@Module({
  controllers: [RecentlyController],
  providers: [
    RecentlyService,
    RecentlyRepository,
    RecentlyEchoScenarioRegistrar,
    RecentlyEchoSubjectDeleteListener,
  ],
  exports: [RecentlyService, RecentlyRepository],
  imports: [
    forwardRef(() => CommentModule),
    EnrichmentModule,
    forwardRef(() => AiEchoModule),
  ],
})
export class RecentlyModule {}
