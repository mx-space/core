import { Controller, Get } from '@nestjs/common'

import { AIAgentService } from './ai-agent.service'

@Controller('ai/test')
export class TestController {
  constructor(private readonly aiAgentService: AIAgentService) {}

  @Get('/')
  async test() {
    return this.aiAgentService.runWithTools(
      'Posts Id: 65e99e28eb677674816310c7 主要了写了什么内容',
    )
  }
}
