import { forwardRef, Module } from '@nestjs/common'

import { McpModule } from '../../mcp/mcp.module'
import { AiModule } from '../ai.module'
import { AIAgentService } from './ai-agent.service'
import { TestController } from './test.controller'

@Module({
  imports: [McpModule, forwardRef(() => AiModule)],
  providers: [AIAgentService],
  controllers: isDev ? [TestController] : [],
})
export class AiAgentModule {}
