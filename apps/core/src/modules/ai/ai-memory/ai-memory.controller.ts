import {
  Body,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { CurrentUser } from '~/common/decorators/current-user.decorator'
import { withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import type { SessionUser } from '~/modules/auth/auth.types'
import { EntityIdDto } from '~/shared/dto/id.dto'

import {
  CreateMemoryDto,
  ListMemoryQueryDto,
  UpdateMemoryDto,
} from './ai-memory.schema'
import { AiMemoryService } from './ai-memory.service'
import type { AiMemory } from './ai-memory.types'
import { type AiMemoryDetailView, AiMemoryViews } from './ai-memory.views'

@ApiController('ai-memory')
export class AiMemoryController {
  constructor(private readonly service: AiMemoryService) {}

  @Get('/')
  @Auth()
  async list(@Query() query: ListMemoryQueryDto) {
    const result = await this.service.list(query)
    return withMeta(
      result.data.map((row) => this.toDetailView(row)),
      new MetaObjectBuilder().pagination(result.pagination).build(),
    )
  }

  @Get('/kpi')
  @Auth()
  async kpi() {
    return this.service.getKpi()
  }

  @Get('/:id')
  @Auth()
  async findById(@Param() params: EntityIdDto) {
    const row = await this.service.findById(params.id)
    return this.toDetailView(row)
  }

  @Post('/')
  @Auth()
  async create(
    @Body() body: CreateMemoryDto,
    @CurrentUser() user: SessionUser,
  ) {
    const row = await this.service.create(body, user.id)
    return this.toDetailView(row)
  }

  @Put('/:id')
  @Auth()
  async update(
    @Param() params: EntityIdDto,
    @Body() body: UpdateMemoryDto,
    @CurrentUser() user: SessionUser,
  ) {
    const row = await this.service.update(params.id, body, user.id)
    return this.toDetailView(row)
  }

  @Delete('/:id')
  @Auth()
  @HttpCode(204)
  async delete(@Param() params: EntityIdDto) {
    await this.service.archive(params.id)
  }

  private toDetailView(row: AiMemory): AiMemoryDetailView {
    return AiMemoryViews.detail.parse({
      id: row.id,
      scope: row.scope,
      type: row.type,
      content: row.content,
      confidence: row.confidence,
      salience: row.salience,
      source: row.source,
      status: row.status,
      firstSeenAt: row.firstSeenAt,
      lastSeenAt: row.lastSeenAt,
      expiresAt: row.expiresAt,
      metadata: row.metadata,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      hasEmbedding: row.embedding !== null,
    })
  }
}
