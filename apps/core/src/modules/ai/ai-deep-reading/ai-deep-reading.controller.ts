import { FastifyReply } from 'fastify'

import { Delete, Get, Param, Post, Query, Res } from '@nestjs/common'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { PagerDto } from '~/shared/dto/pager.dto'

import { ConfigsService } from '../../configs/configs.service'
import { GetDeepReadingQueryDto } from './ai-deep-reading.dto'
import {
  AiDeepReadingService,
  DeepReadingStreamEvent,
} from './ai-deep-reading.service'

@ApiController('ai/deep-readings')
export class AiDeepReadingController {
  constructor(
    private readonly service: AiDeepReadingService,
    private readonly configService: ConfigsService,
  ) {}

  @Get('/')
  @Auth()
  async getDeepReadings(@Query() query: PagerDto) {
    return this.service.getAllDeepReadings(query)
  }

  @Post('/generate/:id')
  @Auth()
  async generateDeepReading(@Param() params: MongoIdDto) {
    return this.service.generateDeepReadingByOpenAI(params.id)
  }

  @Post('/generate-stream/:id')
  @Auth()
  async generateDeepReadingStream(
    @Param() params: MongoIdDto,
    @Res() response: FastifyReply,
  ) {
    response.header('Content-Type', 'text/event-stream')
    response.header('Cache-Control', 'no-cache')
    response.header('Connection', 'keep-alive')

    const stream = this.service.generateDeepReadingStream(params.id)

    const chunks: string[] = []

    stream.subscribe({
      next: (event: DeepReadingStreamEvent) => {
        // 实时流式传输LLM生成的内容片段
        if (event.type === 'content_chunk') {
          response.raw.write(`data: ${JSON.stringify(event)}\n\n`)

          if (typeof event.data === 'string') {
            chunks.push(event.data)
          }
        } else if (
          event.type === 'keyPoints' ||
          event.type === 'criticalAnalysis'
        ) {
          response.raw.write(`data: ${JSON.stringify(event)}\n\n`)
        }
        // 完整内容是最后发送的
        else if (event.type === 'content') {
          response.raw.write(`data: ${JSON.stringify(event)}\n\n`)
        } else if (event.type === 'complete') {
          response.raw.write(`data: ${JSON.stringify(event)}\n\n`)
          response.raw.write(`data: [DONE]\n\n`)
        }
      },
      error: (error) => {
        const errorData = {
          error: true,
          message: error.message || 'An error occurred',
          code: error.code || ErrorCodeEnum.AIException,
        }
        response.raw.write(`data: ${JSON.stringify(errorData)}\n\n`)
        response.raw.end()
      },
      complete: () => {
        response.raw.end()
      },
    })
  }

  @Delete('/:id')
  @Auth()
  async deleteDeepReading(@Param() params: MongoIdDto) {
    return this.service.deleteDeepReadingInDb(params.id)
  }

  @Get('/article/:id')
  async getArticleDeepReading(
    @Param() params: MongoIdDto,
    @Query() query: GetDeepReadingQueryDto,
  ) {
    const dbStored = await this.service.getDeepReadingByArticleId(params.id)

    const aiConfig = await this.configService.get('ai')
    if (!dbStored && !query.onlyDb) {
      const shouldGenerate = aiConfig?.enableDeepReading
      if (shouldGenerate) {
        return this.service.generateDeepReadingByOpenAI(params.id)
      }
    }

    if (!dbStored && !aiConfig.enableDeepReading) {
      throw new BizException(ErrorCodeEnum.AINotEnabled)
    }

    return dbStored
  }

  @Get('/article-stream/:id')
  async getArticleDeepReadingStream(
    @Param() params: MongoIdDto,
    @Res() response: FastifyReply,
  ) {
    const dbStored = await this.service.getDeepReadingByArticleId(params.id)

    if (dbStored) {
      // If already exists, send it as a single SSE event
      response.header('Content-Type', 'text/event-stream')
      response.header('Cache-Control', 'no-cache')
      response.header('Connection', 'keep-alive')

      // Send key points
      response.raw.write(
        `data: ${JSON.stringify({
          type: 'keyPoints',
          data: dbStored.keyPoints,
        })}\n\n`,
      )

      // Send critical analysis
      response.raw.write(
        `data: ${JSON.stringify({
          type: 'criticalAnalysis',
          data: dbStored.criticalAnalysis,
        })}\n\n`,
      )

      // Send content
      response.raw.write(
        `data: ${JSON.stringify({
          type: 'content',
          data: dbStored.content,
        })}\n\n`,
      )

      // Send complete
      response.raw.write(
        `data: ${JSON.stringify({
          type: 'complete',
          data: 'complete',
        })}\n\n`,
      )
      response.raw.write(`data: [DONE]\n\n`)
      response.raw.end()
      return
    }

    const aiConfig = await this.configService.get('ai')
    if (!aiConfig.enableDeepReading) {
      response.status(400).send({
        message: 'AI Deep Reading is not enabled',
        code: ErrorCodeEnum.AINotEnabled,
      })
      return
    }

    response.header('Content-Type', 'text/event-stream')
    response.header('Cache-Control', 'no-cache')
    response.header('Connection', 'keep-alive')

    const stream = this.service.generateDeepReadingStream(params.id)

    const chunks: string[] = []

    stream.subscribe({
      next: (event: DeepReadingStreamEvent) => {
        // 实时流式传输LLM生成的内容片段
        if (event.type === 'content_chunk') {
          response.raw.write(`data: ${JSON.stringify(event)}\n\n`)

          if (typeof event.data === 'string') {
            chunks.push(event.data)
          }
        } else if (
          event.type === 'keyPoints' ||
          event.type === 'criticalAnalysis'
        ) {
          response.raw.write(`data: ${JSON.stringify(event)}\n\n`)
        }
        // 完整内容是最后发送的
        else if (event.type === 'content') {
          response.raw.write(`data: ${JSON.stringify(event)}\n\n`)
        } else if (event.type === 'complete') {
          response.raw.write(`data: ${JSON.stringify(event)}\n\n`)
          response.raw.write(`data: [DONE]\n\n`)
        }
      },
      error: (error) => {
        const errorData = {
          error: true,
          message: error.message || 'An error occurred',
          code: error.code || ErrorCodeEnum.AIException,
        }
        response.raw.write(`data: ${JSON.stringify(errorData)}\n\n`)
        response.raw.end()
      },
      complete: () => {
        response.raw.end()
      },
    })
  }
}
