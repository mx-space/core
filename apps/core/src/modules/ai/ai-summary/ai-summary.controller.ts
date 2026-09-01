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
import { HTTPDecorators } from '~/common/decorators/http.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import {
  type CreateSummaryTaskDto,
  CreateSummaryTaskSchema,
  type CreateSummaryTranslationTaskDto,
  CreateSummaryTranslationTaskSchema,
} from '~/modules/ai/ai-task/ai-task.dto'
import { AiTaskService } from '~/modules/ai/ai-task/ai-task.service'
import { PostMetaBuilder } from '~/modules/post/post-meta-builder'
import { type EntityIdDto, EntityIdSchema } from '~/shared/dto/id.dto'
import { type BasicPagerDto, BasicPagerSchema } from '~/shared/dto/pager.dto'
import { endSse, initSse, sendSseEvent } from '~/utils/sse.util'

import { DEFAULT_SUMMARY_LANG } from '../ai.constants'
import { parseLanguageCode } from '../ai-language.util'
import {
  type GetSummariesGroupedQueryDto,
  GetSummariesGroupedQuerySchema,
  type GetSummaryQueryDto,
  GetSummaryQuerySchema,
  type GetSummaryStreamQueryDto,
  GetSummaryStreamQuerySchema,
  type UpdateSummaryDto,
  UpdateSummarySchema,
} from './ai-summary.schema'
import { AiSummaryService } from './ai-summary.service'

@ApiController('ai/summaries')
export class AiSummaryController {
  constructor(
    private readonly service: AiSummaryService,
    private readonly taskService: AiTaskService,
  ) {}

  @Post('/task')
  @Auth()
  createSummaryTask(
    @Body({ schema: CreateSummaryTaskSchema }) body: CreateSummaryTaskDto,
  ) {
    return this.taskService.createSummaryTask(body)
  }

  @Post('/task/translate')
  @Auth()
  async createSummaryTranslationTask(
    @Body({ schema: CreateSummaryTranslationTaskSchema })
    body: CreateSummaryTranslationTaskDto,
  ) {
    const source = await this.service.findBaseSummaryForArticle(body.refId)
    if (!source) {
      return { taskId: null, created: false, reason: 'source-missing' }
    }
    const sourceLang = source.sourceLang || source.lang
    if (body.targetLang === sourceLang) {
      throw createAppException(AppErrorCode.AI_INVALID_PARAMETER, {
        message: 'targetLang must differ from source lang',
      })
    }
    return this.taskService.createSummaryTranslationTask({
      refId: body.refId,
      sourceSummaryId: source.id!,
      targetLang: body.targetLang,
      force: body.force,
    })
  }

  @Get('/ref/:id')
  @Auth()
  getSummaryByRefId(@Param({ schema: EntityIdSchema }) params: EntityIdDto) {
    return this.service.getSummariesByRefId(params.id)
  }

  @Get('/')
  @Auth()
  async getSummaries(
    @Query({ schema: BasicPagerSchema }) query: BasicPagerDto,
  ) {
    const result = await this.service.getAllSummaries(query)
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
  async getSummariesGrouped(
    @Query({ schema: GetSummariesGroupedQuerySchema })
    query: GetSummariesGroupedQueryDto,
  ) {
    const result = await this.service.getAllSummariesGrouped(query)
    return withMeta(
      result.data,
      new MetaObjectBuilder().pagination(result.pagination).build(),
    )
  }

  @Patch('/:id')
  @Auth()
  updateSummary(
    @Param({ schema: EntityIdSchema }) params: EntityIdDto,
    @Body({ schema: UpdateSummarySchema }) body: UpdateSummaryDto,
  ) {
    return this.service.updateSummaryInDb(params.id, body.summary)
  }

  @Delete('/:id')
  @Auth()
  deleteSummary(@Param({ schema: EntityIdSchema }) params: EntityIdDto) {
    return this.service.deleteSummaryInDb(params.id)
  }

  @Get('/article/:id')
  getArticleSummary(
    @Param({ schema: EntityIdSchema }) params: EntityIdDto,
    @Query({ schema: GetSummaryQuerySchema }) query: GetSummaryQueryDto,
  ) {
    return this.service.getOrGenerateSummaryForArticle(params.id, {
      lang: query.lang ? parseLanguageCode(query.lang) : DEFAULT_SUMMARY_LANG,
      onlyDb: query.onlyDb,
    })
  }

  @Get('/article/:id/generate')
  @HTTPDecorators.RawResponse
  async generateArticleSummary(
    @Param({ schema: EntityIdSchema }) params: EntityIdDto,
    @Query({ schema: GetSummaryStreamQuerySchema })
    query: GetSummaryStreamQueryDto,
    @Res() reply: FastifyReply,
  ) {
    initSse(reply)

    let closed = false
    reply.raw.on('close', () => {
      closed = true
    })

    try {
      const { events } = await this.service.streamSummaryForArticle(params.id, {
        lang: query.lang ? parseLanguageCode(query.lang) : DEFAULT_SUMMARY_LANG,
      })

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
            const doc = await this.service.getSummaryById(event.data.resultId)
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
      if (!closed) {
        endSse(reply)
      }
    }
  }
}
