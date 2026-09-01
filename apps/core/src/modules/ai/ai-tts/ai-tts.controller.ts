import { Body, Delete, Get, Param, Post, Query } from '@nestjs/common'
import { z } from 'zod'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { CurrentReaderId } from '~/common/decorators/current-user.decorator'
import { HasAdminAccess } from '~/common/decorators/role.decorator'
import { withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { PostMetaBuilder } from '~/modules/post/post-meta-builder'
import { EntityIdDto, EntityIdSchema } from '~/shared/dto/id.dto'
import { BasicPagerDto, BasicPagerSchema } from '~/shared/dto/pager.dto'

import { parseLanguageCode } from '../ai-language.util'
import { AiTaskService } from '../ai-task/ai-task.service'
import {
  CreateTtsTaskDto,
  CreateTtsTaskSchema,
  DiscoverTtsVoicesQueryDto,
  DiscoverTtsVoicesQuerySchema,
  GetTtsGroupedQueryDto,
  GetTtsGroupedQuerySchema,
  GetTtsQueryDto,
  GetTtsQuerySchema,
} from './ai-tts.schema'
import { AiTtsService } from './ai-tts.service'
import { AiTtsViews } from './ai-tts.views'
import { AiTtsQueryService } from './ai-tts-query.service'
import { TtsVoiceCatalogService } from './tts-voice-catalog.service'

@ApiController('ai/tts')
export class AiTtsController {
  constructor(
    private readonly service: AiTtsService,
    private readonly queryService: AiTtsQueryService,
    private readonly taskService: AiTaskService,
    private readonly voiceCatalogService: TtsVoiceCatalogService,
  ) {}

  @Get('/voices')
  @Auth()
  discoverVoices(
    @Query({ schema: DiscoverTtsVoicesQuerySchema })
    query: DiscoverTtsVoicesQueryDto,
  ) {
    return this.voiceCatalogService.discover(query)
  }

  @Post('/task')
  @Auth()
  createTask(@Body({ schema: CreateTtsTaskSchema }) body: CreateTtsTaskDto) {
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
  async getByRefId(@Param({ schema: EntityIdSchema }) params: EntityIdDto) {
    const { article, rows } = await this.queryService.getNarrationsByRefId(
      params.id,
    )
    return { article, rows: z.array(AiTtsViews.detail).parse(rows) }
  }

  @Get('/grouped')
  @Auth()
  async listGrouped(
    @Query({ schema: GetTtsGroupedQuerySchema }) query: GetTtsGroupedQueryDto,
  ) {
    const result = await this.queryService.getAllNarrationsGrouped(query)
    return withMeta(
      result.data.map((group) => ({
        article: group.article,
        narrations: z.array(AiTtsViews.detail).parse(group.narrations),
      })),
      new MetaObjectBuilder().pagination(result.pagination).build(),
    )
  }

  @Get('/')
  @Auth()
  async list(@Query({ schema: BasicPagerSchema }) query: BasicPagerDto) {
    const result = await this.queryService.list(query)
    return withMeta(
      z.array(AiTtsViews.listItem).parse(result.data),
      new PostMetaBuilder()
        .pagination(result.pagination)
        .articles(result.articles)
        .build(),
    )
  }

  @Delete('/:id')
  @Auth()
  delete(@Param({ schema: EntityIdSchema }) params: EntityIdDto) {
    return this.service.deleteById(params.id)
  }

  @Get('/article/:id')
  async getArticleTts(
    @Param({ schema: EntityIdSchema }) params: EntityIdDto,
    @Query({ schema: GetTtsQuerySchema }) query: GetTtsQueryDto,
    @HasAdminAccess() isAuthenticated?: boolean,
    @CurrentReaderId() readerId?: string,
  ) {
    const result = await this.queryService.getPublicNarration(
      params.id,
      query.lang ? parseLanguageCode(query.lang) : undefined,
      { isOwner: Boolean(isAuthenticated), password: query.password, readerId },
    )
    return result ? AiTtsViews.public.parse(result) : null
  }
}
