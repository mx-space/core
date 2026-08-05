import { Body, Delete, Get, Param, Post, Query } from '@nestjs/common'
import { z } from 'zod'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { EntityIdDto } from '~/shared/dto/id.dto'
import { BasicPagerDto } from '~/shared/dto/pager.dto'

import { parseLanguageCode } from '../ai-language.util'
import { AiTaskService } from '../ai-task/ai-task.service'
import { CreateTtsTaskDto, GetTtsQueryDto } from './ai-tts.schema'
import { AiTtsService } from './ai-tts.service'
import { AiTtsViews } from './ai-tts.views'
import { AiTtsQueryService } from './ai-tts-query.service'

@ApiController('ai/tts')
export class AiTtsController {
  constructor(
    private readonly service: AiTtsService,
    private readonly queryService: AiTtsQueryService,
    private readonly taskService: AiTaskService,
  ) {}

  @Post('/task')
  @Auth()
  createTask(@Body() body: CreateTtsTaskDto) {
    return this.taskService.createTtsTask({
      refId: body.refId,
      langs: body.langs?.length
        ? [...new Set(body.langs.map((lang) => parseLanguageCode(lang)))]
        : undefined,
      force: body.force,
    })
  }

  @Get('/ref/:id')
  @Auth()
  async getByRefId(@Param() params: EntityIdDto) {
    const rows = await this.queryService.getDetailsByRefId(params.id)
    return z.array(AiTtsViews.detail).parse(rows)
  }

  @Get('/')
  @Auth()
  async list(@Query() query: BasicPagerDto) {
    const result = await this.queryService.list(query)
    return withMeta(
      z.array(AiTtsViews.listItem).parse(result.data),
      new MetaObjectBuilder().pagination(result.pagination).build(),
    )
  }

  @Delete('/:id')
  @Auth()
  delete(@Param() params: EntityIdDto) {
    return this.service.deleteById(params.id)
  }

  @Get('/article/:id')
  async getArticleTts(
    @Param() params: EntityIdDto,
    @Query() query: GetTtsQueryDto,
  ) {
    const result = await this.queryService.getPublicNarration(
      params.id,
      query.lang ? parseLanguageCode(query.lang) : undefined,
    )
    return result ? AiTtsViews.public.parse(result) : null
  }
}
