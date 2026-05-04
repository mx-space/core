import {
  Body,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { EntityIdDto } from '~/shared/dto/id.dto'
import {
  applyRawCorsHeaders,
  endSse,
  initSse,
  sendSseEvent,
} from '~/utils/sse.util'

import {
  AppendMessagesDto,
  ChatProxyDto,
  CreateConversationDto,
  ListConversationsQueryDto,
  ReplaceMessagesDto,
  UpdateConversationDto,
} from './ai-agent.schema'
import { AiAgentChatService } from './ai-agent-chat.service'
import { AiAgentConversationService } from './ai-agent-conversation.service'

@ApiController('ai/agent')
export class AiAgentController {
  constructor(
    private readonly chatService: AiAgentChatService,
    private readonly conversationService: AiAgentConversationService,
  ) {}

  // --- Chat Proxy ---

  @Post('/chat')
  @Auth()
  async chatProxy(
    @Body() body: ChatProxyDto,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const provider = await this.chatService.resolveProvider(body.providerId)
    const {
      url,
      headers,
      body: requestBody,
    } = this.chatService.buildRequestBody(
      provider,
      body.model,
      body.messages,
      body.tools,
    )

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: requestBody,
    })

    if (!response.ok) {
      const errorText = await response.text()
      initSse(reply, request)
      sendSseEvent(reply, 'error', {
        message: `LLM API error (${response.status}): ${errorText}`,
      })
      endSse(reply)
      return
    }

    // Pipe raw SSE stream through to client
    applyRawCorsHeaders(reply, request)
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.setHeader('X-Accel-Buffering', 'no')
    reply.raw.flushHeaders()

    const reader = response.body!.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        reply.raw.write(value)
      }
    } catch {
      // Client disconnected or upstream error
    } finally {
      reader.releaseLock()
      reply.raw.end()
    }
  }

  // --- Conversation CRUD ---

  @Post('/conversations')
  @Auth()
  async createConversation(@Body() body: CreateConversationDto) {
    return this.conversationService.create(body)
  }

  @Get('/conversations')
  @Auth()
  async listConversations(@Query() query: ListConversationsQueryDto) {
    return this.conversationService.listByRef(query.refId, query.refType)
  }

  @Get('/conversations/:id')
  @Auth()
  async getConversation(@Param() params: EntityIdDto) {
    return this.conversationService.getById(params.id)
  }

  @Patch('/conversations/:id')
  @Auth()
  async updateConversation(
    @Param() params: EntityIdDto,
    @Body() body: UpdateConversationDto,
  ) {
    return this.conversationService.updateById(params.id, body)
  }

  @Patch('/conversations/:id/messages')
  @Auth()
  async appendMessages(
    @Param() params: EntityIdDto,
    @Body() body: AppendMessagesDto,
  ) {
    return this.conversationService.appendMessages(params.id, body.messages)
  }

  @Put('/conversations/:id/messages')
  @Auth()
  async replaceMessages(
    @Param() params: EntityIdDto,
    @Body() body: ReplaceMessagesDto,
  ) {
    return this.conversationService.replaceMessages(params.id, body.messages)
  }

  @Delete('/conversations/:id')
  @Auth()
  async deleteConversation(@Param() params: EntityIdDto) {
    return this.conversationService.deleteById(params.id)
  }
}
