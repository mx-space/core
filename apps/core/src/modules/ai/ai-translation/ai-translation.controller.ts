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
  type CreateTranslationAllTaskDto,
  CreateTranslationAllTaskSchema,
  type CreateTranslationBatchTaskDto,
  CreateTranslationBatchTaskSchema,
  type CreateTranslationTaskDto,
  CreateTranslationTaskSchema,
} from '~/modules/ai/ai-task/ai-task.dto'
import { AiTaskService } from '~/modules/ai/ai-task/ai-task.service'
import { type EntityIdDto, EntityIdSchema } from '~/shared/dto/id.dto'
import { endSse, initSse, sendSseEvent } from '~/utils/sse.util'

import {
  type GetTranslationQueryDto,
  GetTranslationQuerySchema,
  type GetTranslationsGroupedQueryDto,
  GetTranslationsGroupedQuerySchema,
  type GetTranslationStreamQueryDto,
  GetTranslationStreamQuerySchema,
  type UpdateTranslationDto,
  UpdateTranslationSchema,
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
  createTranslationTask(
    @Body({ schema: CreateTranslationTaskSchema })
    body: CreateTranslationTaskDto,
  ) {
    return this.taskService.createTranslationTask(body)
  }

  @Post('/task/batch')
  @Auth()
  createTranslationBatchTask(
    @Body({ schema: CreateTranslationBatchTaskSchema })
    body: CreateTranslationBatchTaskDto,
  ) {
    return this.taskService.createTranslationBatchTask(body)
  }

  @Post('/task/all')
  @Auth()
  createTranslationAllTask(
    @Body({ schema: CreateTranslationAllTaskSchema })
    body: CreateTranslationAllTaskDto,
  ) {
    return this.taskService.createTranslationAllTask(body)
  }

  @Get('/ref/:id')
  @Auth()
  getTranslationsByRefId(
    @Param({ schema: EntityIdSchema }) params: EntityIdDto,
  ) {
    return this.service.getTranslationsByRefId(params.id)
  }

  @Get('/grouped')
  @Auth()
  async getTranslationsGrouped(
    @Query({ schema: GetTranslationsGroupedQuerySchema })
    query: GetTranslationsGroupedQueryDto,
  ) {
    const result = await this.service.getAllTranslationsGrouped(query)
    return withMeta(
      result.data,
      new MetaObjectBuilder().pagination(result.pagination).build(),
    )
  }

  @Patch('/:id')
  @Auth()
  updateTranslation(
    @Param({ schema: EntityIdSchema }) params: EntityIdDto,
    @Body({ schema: UpdateTranslationSchema }) body: UpdateTranslationDto,
  ) {
    return this.service.updateTranslation(params.id, body)
  }

  @Delete('/:id')
  @Auth()
  deleteTranslation(@Param({ schema: EntityIdSchema }) params: EntityIdDto) {
    return this.service.deleteTranslation(params.id)
  }

  @Get('/article/:id')
  getArticleTranslation(
    @Param({ schema: EntityIdSchema }) params: EntityIdDto,
    @Query({ schema: GetTranslationQuerySchema }) query: GetTranslationQueryDto,
  ) {
    return this.service.getTranslationForArticle(params.id, query.lang)
  }

  @Get('/article/:id/languages')
  getAvailableLanguages(
    @Param({ schema: EntityIdSchema }) params: EntityIdDto,
  ) {
    return this.service.getAvailableLanguagesForArticle(params.id)
  }

  @Get('/article/:id/generate')
  @HTTPDecorators.RawResponse
  async streamArticleTranslation(
    @Param({ schema: EntityIdSchema }) params: EntityIdDto,
    @Query({ schema: GetTranslationStreamQuerySchema })
    query: GetTranslationStreamQueryDto,
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
        // Public SSE wire safety: drop spec-2 'partial' frames; only
        // token/done/error are part of the byte-pinned public envelope.
        if (event.type === 'partial') continue
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
