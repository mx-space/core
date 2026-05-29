import { forwardRef, Module } from '@nestjs/common'

import { AiModule } from '../ai.module'
import { AiEmbeddingsModule } from '../ai-embeddings/ai-embeddings.module'
import { AiMemoryModule } from '../ai-memory/ai-memory.module'
import { AiPersonaModule } from '../ai-persona/ai-persona.module'
import { AiTaskModule } from '../ai-task/ai-task.module'
import { AiEchoController } from './ai-echo.controller'
import { AiEchoRepository } from './ai-echo.repository'
import { AiEchoService } from './ai-echo.service'
import { EchoScenarioRegistry } from './echo-scenario.registry'
import { EchoGenerateTaskProcessor } from './tasks/echo-generate.processor'

@Module({
  imports: [
    AiTaskModule,
    AiEmbeddingsModule,
    AiPersonaModule,
    AiMemoryModule,
    forwardRef(() => AiModule),
  ],
  controllers: [AiEchoController],
  providers: [
    AiEchoRepository,
    AiEchoService,
    EchoScenarioRegistry,
    EchoGenerateTaskProcessor,
  ],
  exports: [AiEchoService, AiEchoRepository, EchoScenarioRegistry],
})
export class AiEchoModule {}
