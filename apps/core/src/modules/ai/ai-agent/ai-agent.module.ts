import { Module } from '@nestjs/common'
import { AIAgentController } from './ai-agent.controller'
import { AIAgentService } from './ai-agent.service'

@Module({
  providers: [AIAgentService],
  controllers: [AIAgentController],
  exports: [AIAgentService],
})
export class AIAgentModule {}
