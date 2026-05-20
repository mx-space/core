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
import { ResponseV2 } from '~/common/response/v2-controller.decorator'
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
@ResponseV2()
export class AiTranslationController {
  constructor(
    private readonly service: AiTranslationService,
    private readonly taskService: AiTaskService,
  ) {}

  @Post('/task')
  @Auth()
  async createTranslationTask(@Body() body: CreateTranslationTaskDto) {
    const data = await this.taskService.createTranslationTask(body)
    return data
  }

  @Post('/task/batch')
  @Auth()
  async createTranslationBatchTask(
    @Body() body: CreateTranslationBatchTaskDto,
  ) {
    const data = await this.taskService.createTranslationBatchTask(body)
    return data
  }

  @Post('/task/all')
  @Auth()
  async createTranslationAllTask(@Body() body: CreateTranslationAllTaskDto) {
    const data = await this.taskService.createTranslationAllTask(body)
    return data
  }

  @Get('/ref/:id')
  @Auth()
  async getTranslationsByRefId(@Param() params: EntityIdDto) {
    const data = await this.service.getTranslationsByRefId(params.id)
    return data
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
  async updateTranslation(
    @Param() params: EntityIdDto,
    @Body() body: UpdateTranslationDto,
  ) {
    const data = await this.service.updateTranslation(params.id, body)
    return data
  }

  @Delete('/:id')
  @Auth()
  async deleteTranslation(@Param() params: EntityIdDto) {
    const data = await this.service.deleteTranslation(params.id)
    return data
  }

  @Get('/article/:id')
  async getArticleTranslation(
    @Param() params: EntityIdDto,
    @Query() query: GetTranslationQueryDto,
  ) {
    const data = await this.service.getTranslationForArticle(
      params.id,
      query.lang,
    )
    return data
  }

  @Get('/article/:id/languages')
  async getAvailableLanguages(@Param() params: EntityIdDto) {
    const data = await this.service.getAvailableLanguagesForArticle(params.id)
    return data
  }

  @Get('/article/:id/generate')
  @RawResponse
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
