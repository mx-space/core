import {
  Body,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { BypassCaseTransform } from '~/common/decorators/bypass-case-transform.decorator'
import { WithFastifyRouteOptions } from '~/common/decorators/fastify-route-options.decorator'
import { type EntityIdDto, EntityIdSchema } from '~/shared/dto/id.dto'

import {
  type AppendMessagesDto,
  AppendMessagesSchema,
  type CreateConversationDto,
  CreateConversationSchema,
  type ListConversationsQueryDto,
  ListConversationsQuerySchema,
  type ReplaceMessagesDto,
  ReplaceMessagesSchema,
  type UpdateConversationDto,
  UpdateConversationSchema,
} from './ai-agent.schema'
import { AiAgentConversationService } from './ai-agent-conversation.service'

// Review batches embed base/preview document snapshots, so a long session on a
// large post passes Fastify's 1 MB default and the client would silently drop turns.
const CONVERSATION_PAYLOAD_BYTES = 32 * 1024 * 1024

@ApiController('ai/agent')
export class AiAgentController {
  constructor(
    private readonly conversationService: AiAgentConversationService,
  ) {}

  @Post('/conversations')
  @Auth()
  @WithFastifyRouteOptions({ bodyLimit: CONVERSATION_PAYLOAD_BYTES })
  @BypassCaseTransform(['data.messages[]'])
  createConversation(
    @Body({ schema: CreateConversationSchema }) body: CreateConversationDto,
  ) {
    return this.conversationService.create(body)
  }

  @Get('/conversations')
  @Auth()
  listConversations(
    @Query({ schema: ListConversationsQuerySchema })
    query: ListConversationsQueryDto,
  ) {
    return this.conversationService.listBySession(query.sessionId)
  }

  @Get('/conversations/:id')
  @Auth()
  @BypassCaseTransform(['data.messages[]'])
  getConversation(@Param({ schema: EntityIdSchema }) params: EntityIdDto) {
    return this.conversationService.getById(params.id)
  }

  @Patch('/conversations/:id')
  @Auth()
  updateConversation(
    @Param({ schema: EntityIdSchema }) params: EntityIdDto,
    @Body({ schema: UpdateConversationSchema }) body: UpdateConversationDto,
  ) {
    return this.conversationService.updateById(params.id, body)
  }

  @Patch('/conversations/:id/messages')
  @Auth()
  @WithFastifyRouteOptions({ bodyLimit: CONVERSATION_PAYLOAD_BYTES })
  appendMessages(
    @Param({ schema: EntityIdSchema }) params: EntityIdDto,
    @Body({ schema: AppendMessagesSchema }) body: AppendMessagesDto,
  ) {
    return this.conversationService.appendMessages(params.id, body.messages)
  }

  @Put('/conversations/:id/messages')
  @Auth()
  @WithFastifyRouteOptions({ bodyLimit: CONVERSATION_PAYLOAD_BYTES })
  replaceMessages(
    @Param({ schema: EntityIdSchema }) params: EntityIdDto,
    @Body({ schema: ReplaceMessagesSchema }) body: ReplaceMessagesDto,
  ) {
    return this.conversationService.replaceMessages(params.id, body.messages)
  }

  @Delete('/conversations/:id')
  @Auth()
  deleteConversation(@Param({ schema: EntityIdSchema }) params: EntityIdDto) {
    return this.conversationService.deleteById(params.id)
  }

  @Post('/conversations/:id/title')
  @HttpCode(200)
  @Auth()
  generateConversationTitle(
    @Param({ schema: EntityIdSchema }) params: EntityIdDto,
  ) {
    return this.conversationService.generateAndPersistTitle(params.id)
  }
}
