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
import { withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import { RawResponse } from '~/common/response/raw-response.decorator'
import { CreateSummaryTaskDto } from '~/modules/ai/ai-task/ai-task.dto'
import { AiTaskService } from '~/modules/ai/ai-task/ai-task.service'
import { EntityIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'
import { endSse, initSse, sendSseEvent } from '~/utils/sse.util'

import { DEFAULT_SUMMARY_LANG } from '../ai.constants'
import { parseLanguageCode } from '../ai-language.util'
import {
  GetSummariesGroupedQueryDto,
  GetSummaryQueryDto,
  GetSummaryStreamQueryDto,
  UpdateSummaryDto,
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
  async createSummaryTask(@Body() body: CreateSummaryTaskDto) {
    const data = await this.taskService.createSummaryTask(body)
    return data
  }

  @Get('/ref/:id')
  @Auth()
  async getSummaryByRefId(@Param() params: EntityIdDto) {
    const data = await this.service.getSummariesByRefId(params.id)
    return data
  }

  @Get('/')
  @Auth()
  async getSummaries(@Query() query: PagerDto) {
    const result = await this.service.getAllSummaries(query)
    return withMeta(
      result.data,
      new MetaObjectBuilder()
        .pagination(result.pagination)
        .articles(result.articles)
        .build(),
    )
  }

  @Get('/grouped')
  @Auth()
  async getSummariesGrouped(@Query() query: GetSummariesGroupedQueryDto) {
    const result = await this.service.getAllSummariesGrouped(query)
    return withMeta(
      result.data,
      new MetaObjectBuilder().pagination(result.pagination).build(),
    )
  }

  @Patch('/:id')
  @Auth()
  async updateSummary(
    @Param() params: EntityIdDto,
    @Body() body: UpdateSummaryDto,
  ) {
    const data = await this.service.updateSummaryInDb(params.id, body.summary)
    return data
  }

  @Delete('/:id')
  @Auth()
  async deleteSummary(@Param() params: EntityIdDto) {
    const data = await this.service.deleteSummaryInDb(params.id)
    return data
  }

  @Get('/article/:id')
  async getArticleSummary(
    @Param() params: EntityIdDto,
    @Query() query: GetSummaryQueryDto,
  ) {
    const data = await this.service.getOrGenerateSummaryForArticle(params.id, {
      lang: query.lang ? parseLanguageCode(query.lang) : DEFAULT_SUMMARY_LANG,
      onlyDb: query.onlyDb,
    })
    return data
  }

  @Get('/article/:id/generate')
  @RawResponse
  async generateArticleSummary(
    @Param() params: EntityIdDto,
    @Query() query: GetSummaryStreamQueryDto,
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
