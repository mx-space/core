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
  type ListConversationsQueryDto,
  ListConversationsQuerySchema,
  type SaveReviewStateDto,
  SaveReviewStateSchema,
  type UpdateConversationDto,
  UpdateConversationSchema,
} from './ai-agent.schema'
import { AiAgentConversationService } from './ai-agent-conversation.service'

// Review batches embed base/preview document snapshots, so a long session on a
// large post passes Fastify's 1 MB default.
const REVIEW_STATE_PAYLOAD_BYTES = 32 * 1024 * 1024

@ApiController('ai/agent')
export class AiAgentController {
  constructor(
    private readonly conversationService: AiAgentConversationService,
  ) {}

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
  @BypassCaseTransform(['data.bubbles[]', 'data.reviewState', 'data.anchors'])
  getConversation(@Param({ schema: EntityIdSchema }) params: EntityIdDto) {
    return this.conversationService.getDetail(params.id)
  }

  @Patch('/conversations/:id')
  @Auth()
  updateConversation(
    @Param({ schema: EntityIdSchema }) params: EntityIdDto,
    @Body({ schema: UpdateConversationSchema }) body: UpdateConversationDto,
  ) {
    return this.conversationService.updateById(params.id, body)
  }

  @Put('/conversations/:id/review-state')
  @Auth()
  @WithFastifyRouteOptions({ bodyLimit: REVIEW_STATE_PAYLOAD_BYTES })
  saveReviewState(
    @Param({ schema: EntityIdSchema }) params: EntityIdDto,
    @Body({ schema: SaveReviewStateSchema }) body: SaveReviewStateDto,
  ) {
    return this.conversationService.saveReviewState(params.id, body)
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
