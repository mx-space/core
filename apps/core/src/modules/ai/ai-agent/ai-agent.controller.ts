import type { AssistantMessageEvent } from '@earendil-works/pi-ai'
import type { AiAgentSseEvent } from '@mx-space/api-client'
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
import { BypassCaseTransform } from '~/common/decorators/bypass-case-transform.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { EntityIdDto } from '~/shared/dto/id.dto'
import { applyRawCorsHeaders } from '~/utils/sse.util'

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

const HEARTBEAT_INTERVAL_MS = 15_000

@ApiController('ai/agent')
export class AiAgentController {
  constructor(
    private readonly chatService: AiAgentChatService,
    private readonly conversationService: AiAgentConversationService,
  ) {}

  @Post('/chat')
  @Auth()
  @HTTPDecorators.RawResponse
  async chatProxy(
    @Body() body: ChatProxyDto,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    applyRawCorsHeaders(reply, request)
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.setHeader('X-Accel-Buffering', 'no')
    reply.raw.flushHeaders()

    const abortController = new AbortController()
    const onClose = () => abortController.abort()
    const onAborted = () => abortController.abort()
    reply.raw.on('close', onClose)
    request.raw.on('aborted', onAborted)

    const writeFrame = (event: AiAgentSseEvent) => {
      if (reply.raw.writableEnded) return
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
    }
    const writeHeartbeat = () => {
      if (reply.raw.writableEnded) return
      reply.raw.write(`: ping\n\n`)
    }

    const heartbeat = setInterval(writeHeartbeat, HEARTBEAT_INTERVAL_MS)

    try {
      const events = this.chatService.streamChat({
        model: body.model,
        providerId: body.providerId,
        messages: body.messages,
        tools: body.tools,
        signal: abortController.signal,
      })

      for await (const event of events) {
        const frame = mapPiEventToSse(event)
        if (!frame) continue
        writeFrame(frame)
        if (frame.type === 'done' || frame.type === 'error') {
          break
        }
      }
    } catch (error) {
      const reason = abortController.signal.aborted ? 'aborted' : 'error'
      writeFrame({
        type: 'error',
        reason,
        message: (error as Error)?.message ?? 'Unknown error',
      })
    } finally {
      clearInterval(heartbeat)
      reply.raw.off('close', onClose)
      request.raw.off('aborted', onAborted)
      if (!reply.raw.writableEnded) {
        reply.raw.end()
      }
    }
  }

  @Post('/conversations')
  @Auth()
  @BypassCaseTransform(['data.messages[]'])
  createConversation(@Body() body: CreateConversationDto) {
    return this.conversationService.create(body)
  }

  @Get('/conversations')
  @Auth()
  listConversations(@Query() query: ListConversationsQueryDto) {
    return this.conversationService.listBySession(query.sessionId)
  }

  @Get('/conversations/:id')
  @Auth()
  @BypassCaseTransform(['data.messages[]'])
  getConversation(@Param() params: EntityIdDto) {
    return this.conversationService.getById(params.id)
  }

  @Patch('/conversations/:id')
  @Auth()
  updateConversation(
    @Param() params: EntityIdDto,
    @Body() body: UpdateConversationDto,
  ) {
    return this.conversationService.updateById(params.id, body)
  }

  @Patch('/conversations/:id/messages')
  @Auth()
  appendMessages(
    @Param() params: EntityIdDto,
    @Body() body: AppendMessagesDto,
  ) {
    return this.conversationService.appendMessages(params.id, body.messages)
  }

  @Put('/conversations/:id/messages')
  @Auth()
  replaceMessages(
    @Param() params: EntityIdDto,
    @Body() body: ReplaceMessagesDto,
  ) {
    return this.conversationService.replaceMessages(params.id, body.messages)
  }

  @Delete('/conversations/:id')
  @Auth()
  deleteConversation(@Param() params: EntityIdDto) {
    return this.conversationService.deleteById(params.id)
  }

  @Post('/conversations/:id/title')
  @Auth()
  generateConversationTitle(@Param() params: EntityIdDto) {
    return this.conversationService.generateAndPersistTitle(params.id)
  }
}

function mapPiEventToSse(event: AssistantMessageEvent): AiAgentSseEvent | null {
  switch (event.type) {
    case 'text_start': {
      return { type: 'text_start', contentIndex: event.contentIndex }
    }
    case 'text_delta': {
      return {
        type: 'text_delta',
        contentIndex: event.contentIndex,
        delta: event.delta,
      }
    }
    case 'text_end': {
      return { type: 'text_end', contentIndex: event.contentIndex }
    }
    case 'thinking_start': {
      return { type: 'thinking_start', contentIndex: event.contentIndex }
    }
    case 'thinking_delta': {
      return {
        type: 'thinking_delta',
        contentIndex: event.contentIndex,
        delta: event.delta,
      }
    }
    case 'thinking_end': {
      return { type: 'thinking_end', contentIndex: event.contentIndex }
    }
    case 'toolcall_start': {
      const name = extractToolCallName(event.partial, event.contentIndex)
      return {
        type: 'toolcall_start',
        contentIndex: event.contentIndex,
        ...(name !== undefined ? { name } : {}),
      }
    }
    case 'toolcall_delta': {
      const partialArgs = safeParsePartialArgs(event.delta)
      return {
        type: 'toolcall_delta',
        contentIndex: event.contentIndex,
        partialArgs,
      }
    }
    case 'toolcall_end': {
      return {
        type: 'toolcall_end',
        contentIndex: event.contentIndex,
        toolCall: {
          id: event.toolCall.id,
          name: event.toolCall.name,
          arguments: event.toolCall.arguments ?? {},
        },
      }
    }
    case 'done': {
      return {
        type: 'done',
        message: event.message as unknown as Record<string, unknown>,
      }
    }
    case 'error': {
      return {
        type: 'error',
        reason: event.reason,
        message:
          event.error.errorMessage ??
          (event.reason === 'aborted' ? 'Stream aborted' : 'Stream error'),
      }
    }
    case 'start': {
      return null
    }
    default: {
      return null
    }
  }
}

function extractToolCallName(
  partial: unknown,
  contentIndex: number,
): string | undefined {
  const blocks = (partial as { content?: Array<Record<string, unknown>> })
    ?.content
  if (!Array.isArray(blocks)) return undefined
  const block = blocks[contentIndex]
  if (block && block.type === 'toolCall' && typeof block.name === 'string') {
    return block.name
  }
  return undefined
}

function safeParsePartialArgs(delta: string): Record<string, unknown> {
  if (!delta) return {}
  try {
    const parsed = JSON.parse(delta) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // partial JSON fragment — emit raw delta under a known key so the admin can
    // accumulate it without losing data.
    return { __partial: delta }
  }
  return {}
}
