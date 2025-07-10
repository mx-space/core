import { Readable } from 'node:stream'
import { FastifyReply } from 'fastify'

import { Body, Get, Post, Res } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'

import { ConfigsService } from '../../configs/configs.service'
import { ChatRequestDto, ChatResponseDto } from './ai-agent.dto'
import { AIAgentService } from './ai-agent.service'

@ApiController('ai/agent')
export class AIAgentController {
  constructor(
    private readonly aiAgentService: AIAgentService,
    private readonly configService: ConfigsService,
  ) {}

  @Post('chat')
  @Auth()
  async chat(
    @Body() chatRequest: ChatRequestDto,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const result = await this.aiAgentService.chatWithTools(chatRequest.message)

    // 使用 toDataStreamResponse 获取 SSE 格式的响应
    const response = result.toDataStreamResponse()

    // 设置响应头
    response.headers.forEach((value, key) => {
      reply.header(key, value)
    })

    // 将 Web Response 的 ReadableStream 转换为 Node.js Readable 流
    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as any)
      return reply.send(nodeStream)
    }
  }
}
