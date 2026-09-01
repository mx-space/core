import {
  Body,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common'
import type { FastifyReply } from 'fastify'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { CurrentReaderId } from '~/common/decorators/current-user.decorator'
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { HasAdminAccess } from '~/common/decorators/role.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { PostMetaBuilder } from '~/modules/post/post-meta-builder'
import { type EntityIdDto, EntityIdSchema } from '~/shared/dto/id.dto'
import { type BasicPagerDto, BasicPagerSchema } from '~/shared/dto/pager.dto'
import { endSse, initSse, sendSseEvent } from '~/utils/sse.util'

import { DEFAULT_SUMMARY_LANG } from '../ai.constants'
import { parseLanguageCode } from '../ai-language.util'
import { AiTaskService } from '../ai-task/ai-task.service'
import {
  type CreateInsightsTaskDto,
  CreateInsightsTaskSchema,
  type CreateInsightsTranslationTaskDto,
  CreateInsightsTranslationTaskSchema,
  type GetInsightsGroupedQueryDto,
  GetInsightsGroupedQuerySchema,
  type GetInsightsQueryDto,
  GetInsightsQuerySchema,
  type GetInsightsStreamQueryDto,
  GetInsightsStreamQuerySchema,
  type UpdateInsightsDto,
  UpdateInsightsSchema,
} from './ai-insights.schema'
import { AiInsightsService } from './ai-insights.service'

@ApiController('ai/insights')
export class AiInsightsController {
  constructor(
    private readonly service: AiInsightsService,
    private readonly taskService: AiTaskService,
  ) {}

  @Post('/task')
  @Auth()
  createInsightsTask(
    @Body({ schema: CreateInsightsTaskSchema }) body: CreateInsightsTaskDto,
  ) {
    return this.taskService.createInsightsTask(body)
  }

  @Post('/task/translate')
  @Auth()
  async createInsightsTranslationTask(
    @Body({ schema: CreateInsightsTranslationTaskSchema })
    body: CreateInsightsTranslationTaskDto,
  ) {
    const source = await this.service.findSourceInsightsForArticle(body.refId)
    if (!source) {
      return { taskId: null, created: false, reason: 'source-missing' }
    }
    const sourceLang = source.sourceLang || source.lang
    if (body.targetLang === sourceLang) {
      throw createAppException(AppErrorCode.AI_INVALID_PARAMETER, {
        message: 'targetLang must differ from source lang',
      })
    }
    return this.taskService.createInsightsTranslationTask({
      refId: body.refId,
      sourceInsightsId: source.id!,
      targetLang: body.targetLang,
      force: body.force,
    })
  }

  @Get('/ref/:id')
  @Auth()
  getInsightsByRefId(@Param({ schema: EntityIdSchema }) params: EntityIdDto) {
    return this.service.getInsightsByRefId(params.id)
  }

  @Get('/')
  @Auth()
  async getInsights(@Query({ schema: BasicPagerSchema }) query: BasicPagerDto) {
    const result = await this.service.getAllInsights(query)
    return withMeta(
      result.data,
      new PostMetaBuilder()
        .pagination(result.pagination)
        .articles(result.articles)
        .build(),
    )
  }

  @Get('/grouped')
  @Auth()
  async getInsightsGrouped(
    @Query({ schema: GetInsightsGroupedQuerySchema })
    query: GetInsightsGroupedQueryDto,
  ) {
    const result = await this.service.getAllInsightsGrouped(query)
    return withMeta(
      result.data,
      new MetaObjectBuilder().pagination(result.pagination).build(),
    )
  }

  @Patch('/:id')
  @Auth()
  updateInsights(
    @Param({ schema: EntityIdSchema }) params: EntityIdDto,
    @Body({ schema: UpdateInsightsSchema }) body: UpdateInsightsDto,
  ) {
    return this.service.updateInsightsInDb(params.id, body.content)
  }

  @Delete('/:id')
  @Auth()
  deleteInsights(@Param({ schema: EntityIdSchema }) params: EntityIdDto) {
    return this.service.deleteInsightsInDb(params.id)
  }

  @Get('/article/:id')
  getArticleInsights(
    @Param({ schema: EntityIdSchema }) params: EntityIdDto,
    @Query({ schema: GetInsightsQuerySchema }) query: GetInsightsQueryDto,
    @HasAdminAccess() isOwner?: boolean,
    @CurrentReaderId() readerId?: string,
  ) {
    return this.service.getOrGenerateInsightsForArticle(params.id, {
      lang: query.lang ? parseLanguageCode(query.lang) : DEFAULT_SUMMARY_LANG,
      onlyDb: query.onlyDb,
      isOwner: Boolean(isOwner),
      readerId,
    })
  }

  @Get('/article/:id/generate')
  @HTTPDecorators.RawResponse
  async generateArticleInsights(
    @Param({ schema: EntityIdSchema }) params: EntityIdDto,
    @Query({ schema: GetInsightsStreamQuerySchema })
    query: GetInsightsStreamQueryDto,
    @Res() reply: FastifyReply,
    @HasAdminAccess() isOwner?: boolean,
    @CurrentReaderId() readerId?: string,
  ) {
    initSse(reply)
    let closed = false
    reply.raw.on('close', () => {
      closed = true
    })
    try {
      const { events } = await this.service.streamInsightsForArticle(
        params.id,
        {
          lang: query.lang
            ? parseLanguageCode(query.lang)
            : DEFAULT_SUMMARY_LANG,
          isOwner: Boolean(isOwner),
          readerId,
        },
      )
      let sentToken = false
      for await (const event of events) {
        if (closed) break
        // Public SSE wire safety: drop spec-2 'partial' frames; only
        // token/done/error are part of the byte-pinned public envelope.
        if (event.type === 'partial') continue
        if (event.type === 'token') {
          sendSseEvent(reply, 'token', event.data)
          sentToken = true
        } else if (event.type === 'done') {
          if (!sentToken) {
            const doc = await this.service.getInsightsById(event.data.resultId)
            sendSseEvent(reply, 'token', doc)
          }
          sendSseEvent(reply, 'done', undefined)
        } else {
          sendSseEvent(reply, 'error', event.data)
        }
        if (event.type === 'done' || event.type === 'error') break
      }
    } catch (error) {
      if (!closed) {
        sendSseEvent(reply, 'error', {
          message: (error as Error)?.message || 'AI stream error',
        })
      }
    } finally {
      if (!closed) endSse(reply)
    }
  }
}
