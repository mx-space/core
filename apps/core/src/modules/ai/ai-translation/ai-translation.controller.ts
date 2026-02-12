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
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import {
  CreateTranslationAllTaskDto,
  CreateTranslationBatchTaskDto,
  CreateTranslationTaskDto,
} from '~/modules/ai/ai-task/ai-task.dto'
import { AiTaskService } from '~/modules/ai/ai-task/ai-task.service'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { endSse, initSse, sendSseEvent } from '~/utils/sse.util'
import type { FastifyReply } from 'fastify'
import {
  GetTranslationQueryDto,
  GetTranslationsGroupedQueryDto,
  GetTranslationStreamQueryDto,
  UpdateTranslationDto,
} from './ai-translation.schema'
import { AiTranslationService } from './ai-translation.service'

@ApiController('ai/translations')
export class AiTranslationController {
  constructor(
    private readonly service: AiTranslationService,
    private readonly taskService: AiTaskService,
  ) {}

  @Post('/task')
  @Auth()
  async createTranslationTask(@Body() body: CreateTranslationTaskDto) {
    return this.taskService.createTranslationTask(body)
  }

  @Post('/task/batch')
  @Auth()
  async createTranslationBatchTask(
    @Body() body: CreateTranslationBatchTaskDto,
  ) {
    return this.taskService.createTranslationBatchTask(body)
  }

  @Post('/task/all')
  @Auth()
  async createTranslationAllTask(@Body() body: CreateTranslationAllTaskDto) {
    return this.taskService.createTranslationAllTask(body)
  }

  @Get('/ref/:id')
  @Auth()
  async getTranslationsByRefId(@Param() params: MongoIdDto) {
    return this.service.getTranslationsByRefId(params.id)
  }

  @Get('/grouped')
  @Auth()
  async getTranslationsGrouped(@Query() query: GetTranslationsGroupedQueryDto) {
    return this.service.getAllTranslationsGrouped(query)
  }

  @Patch('/:id')
  @Auth()
  async updateTranslation(
    @Param() params: MongoIdDto,
    @Body() body: UpdateTranslationDto,
  ) {
    return this.service.updateTranslation(params.id, body)
  }

  @Delete('/:id')
  @Auth()
  async deleteTranslation(@Param() params: MongoIdDto) {
    return this.service.deleteTranslation(params.id)
  }

  @Get('/article/:id')
  async getArticleTranslation(
    @Param() params: MongoIdDto,
    @Query() query: GetTranslationQueryDto,
  ) {
    return this.service.getTranslationForArticle(params.id, query.lang)
  }

  @Get('/article/:id/languages')
  async getAvailableLanguages(@Param() params: MongoIdDto) {
    return this.service.getAvailableLanguagesForArticle(params.id)
  }

  @Get('/article/:id/generate')
  async streamArticleTranslation(
    @Param() params: MongoIdDto,
    @Query() query: GetTranslationStreamQueryDto,
    @Res() reply: FastifyReply,
  ) {
    initSse(reply)

    let closed = false
    reply.raw.on('close', () => {
      closed = true
    })

    try {
      const { events } = await this.service.streamTranslationForArticle(
        params.id,
        query.lang,
      )

      let sentToken = false
      for await (const event of events) {
        if (closed) break
        if (event.type === 'token') {
          sendSseEvent(reply, 'token', event.data)
          sentToken = true
        } else if (event.type === 'done') {
          if (!sentToken) {
            const doc = await this.service.getTranslationById(
              event.data.resultId,
            )
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
