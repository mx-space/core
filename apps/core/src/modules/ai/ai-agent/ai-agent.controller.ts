import { Body, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { MongoIdDto } from '~/shared/dto/id.dto'
import {
  CreateAIAgentSessionDto,
  GetAIAgentMessagesQueryDto,
  SendAIAgentMessageDto,
  UpsertAIAgentConfigDto,
} from './ai-agent.schema'
import { AIAgentService } from './ai-agent.service'

@ApiController('ai/agent')
export class AIAgentController {
  constructor(private readonly service: AIAgentService) {}

  @Get('/config')
  @Auth()
  async getConfig() {
    return this.service.getRuntimeConfig()
  }

  @Put('/config')
  @Auth()
  async putConfig(@Body() body: UpsertAIAgentConfigDto) {
    return this.service.upsertRuntimeConfig(body)
  }

  @Post('/sessions')
  @Auth()
  async createSession(@Body() body: CreateAIAgentSessionDto) {
    return this.service.createSession(body.title)
  }

  @Get('/sessions')
  @Auth()
  async getSessions() {
    return this.service.listSessions()
  }

  @Get('/sessions/:id')
  @Auth()
  async getSession(@Param() params: MongoIdDto) {
    return this.service.getSession(params.id)
  }

  @Get('/sessions/:id/messages')
  @Auth()
  async getSessionMessages(
    @Param() params: MongoIdDto,
    @Query() query: GetAIAgentMessagesQueryDto,
  ) {
    return this.service.getSessionMessages(params.id, query.page, query.size)
  }

  @Post('/sessions/:id/messages')
  @Auth()
  async sendMessage(
    @Param() params: MongoIdDto,
    @Body() body: SendAIAgentMessageDto,
  ) {
    return this.service.sendMessage(params.id, body)
  }

  @Post('/actions/:id/confirm')
  @Auth()
  async confirmAction(@Param() params: MongoIdDto) {
    return this.service.confirmAction(params.id)
  }

  @Post('/actions/:id/reject')
  @Auth()
  async rejectAction(@Param() params: MongoIdDto) {
    return this.service.rejectAction(params.id)
  }
}
