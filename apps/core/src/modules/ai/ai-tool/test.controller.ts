import { Controller, Get } from '@nestjs/common'

import { AiToolService } from './ai-tool.service'

@Controller('ai/test')
export class TestController {
  constructor(private readonly aiToolService: AiToolService) {}

  @Get('test')
  async test() {
    return this.aiToolService.runWithTools('我的最近十篇文章主要了写了什么内容')
  }
}
