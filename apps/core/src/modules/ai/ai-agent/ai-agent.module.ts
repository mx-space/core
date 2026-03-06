import { Module } from '@nestjs/common'

import { AIAgentController } from './ai-agent.controller'
import { AIAgentService } from './ai-agent.service'
import { AIAgentContextEngineService } from './context-engine/ai-agent-context-engine.service'
import { AIAgentSessionLockService } from './infra/ai-agent-session-lock.service'
import { AIAgentModelFactoryService } from './model-runtime/ai-agent-model-factory.service'
import { AIAgentRuntimeService } from './runtime/ai-agent-runtime.service'
import { AIAgentToolsEngineService } from './tools-engine/ai-agent-tools-engine.service'

@Module({
  providers: [
    AIAgentService,
    AIAgentRuntimeService,
    AIAgentModelFactoryService,
    AIAgentContextEngineService,
    AIAgentToolsEngineService,
    AIAgentSessionLockService,
  ],
  controllers: [AIAgentController],
  exports: [AIAgentService],
})
export class AIAgentModule {}
