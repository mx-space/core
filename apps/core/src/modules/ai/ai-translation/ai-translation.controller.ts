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
import { withMeta } from '~/common/response/envelope.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import {
  CreateTranslationAllTaskDto,
  CreateTranslationBatchTaskDto,
  CreateTranslationTaskDto,
} from '~/modules/ai/ai-task/ai-task.dto'
import { AiTaskService } from '~/modules/ai/ai-task/ai-task.service'
import { EntityIdDto } from '~/shared/dto/id.dto'
import { endSse, initSse, sendSseEvent } from '~/utils/sse.util'

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
  createTranslationTask(@Body() body: CreateTranslationTaskDto) {
    return this.taskService.createTranslationTask(body)
  }

  @Post('/task/batch')
  @Auth()
  createTranslationBatchTask(@Body() body: CreateTranslationBatchTaskDto) {
    return this.taskService.createTranslationBatchTask(body)
  }

  @Post('/task/all')
  @Auth()
  createTranslationAllTask(@Body() body: CreateTranslationAllTaskDto) {
    return this.taskService.createTranslationAllTask(body)
  }

  @Get('/ref/:id')
  @Auth()
  getTranslationsByRefId(@Param() params: EntityIdDto) {
    return this.service.getTranslationsByRefId(params.id)
  }

  @Get('/grouped')
  @Auth()
  async getTranslationsGrouped(@Query() query: GetTranslationsGroupedQueryDto) {
    const result = await this.service.getAllTranslationsGrouped(query)
    return withMeta(
      result.data,
      new MetaObjectBuilder().pagination(result.pagination).build(),
    )
  }

  @Patch('/:id')
  @Auth()
  updateTranslation(
    @Param() params: EntityIdDto,
    @Body() body: UpdateTranslationDto,
  ) {
    return this.service.updateTranslation(params.id, body)
  }

  @Delete('/:id')
  @Auth()
  deleteTranslation(@Param() params: EntityIdDto) {
    return this.service.deleteTranslation(params.id)
  }

  @Get('/article/:id')
  getArticleTranslation(
    @Param() params: EntityIdDto,
    @Query() query: GetTranslationQueryDto,
  ) {
    return this.service.getTranslationForArticle(params.id, query.lang)
  }

  @Get('/article/:id/languages')
  getAvailableLanguages(@Param() params: EntityIdDto) {
    return this.service.getAvailableLanguagesForArticle(params.id)
  }

  @Get('/article/:id/generate')
  @HTTPDecorators.RawResponse
  async streamArticleTranslation(
    @Param() params: EntityIdDto,
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
