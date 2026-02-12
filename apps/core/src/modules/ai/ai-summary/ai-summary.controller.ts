import {
  Body,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { CreateSummaryTaskDto } from '~/modules/ai/ai-task/ai-task.dto'
import { AiTaskService } from '~/modules/ai/ai-task/ai-task.service'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'
import type { FastifyBizRequest } from '~/transformers/get-req.transformer'
import { endSse, initSse, sendSseEvent } from '~/utils/sse.util'
import type { FastifyReply } from 'fastify'
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
    return this.taskService.createSummaryTask(body)
  }

  @Get('/ref/:id')
  @Auth()
  async getSummaryByRefId(@Param() params: MongoIdDto) {
    return this.service.getSummariesByRefId(params.id)
  }

  @Get('/')
  @Auth()
  async getSummaries(@Query() query: PagerDto) {
    return this.service.getAllSummaries(query)
  }

  @Get('/grouped')
  @Auth()
  async getSummariesGrouped(@Query() query: GetSummariesGroupedQueryDto) {
    return this.service.getAllSummariesGrouped(query)
  }

  @Patch('/:id')
  @Auth()
  async updateSummary(
    @Param() params: MongoIdDto,
    @Body() body: UpdateSummaryDto,
  ) {
    return this.service.updateSummaryInDb(params.id, body.summary)
  }

  @Delete('/:id')
  @Auth()
  async deleteSummary(@Param() params: MongoIdDto) {
    return this.service.deleteSummaryInDb(params.id)
  }

  @Get('/article/:id')
  async getArticleSummary(
    @Param() params: MongoIdDto,
    @Query() query: GetSummaryQueryDto,
    @Req() req: FastifyBizRequest,
  ) {
    const acceptLanguage = req.headers['accept-language']

    return this.service.getOrGenerateSummaryForArticle(params.id, {
      preferredLang: query.lang,
      acceptLanguage,
      onlyDb: query.onlyDb,
    })
  }

  @Get('/article/:id/generate')
  async generateArticleSummary(
    @Param() params: MongoIdDto,
    @Query() query: GetSummaryStreamQueryDto,
    @Req() req: FastifyBizRequest,
    @Res() reply: FastifyReply,
  ) {
    initSse(reply)

    let closed = false
    reply.raw.on('close', () => {
      closed = true
    })

    const acceptLanguage = req.headers['accept-language']

    try {
      const { events } = await this.service.streamSummaryForArticle(params.id, {
        preferredLang: query.lang,
        acceptLanguage,
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
