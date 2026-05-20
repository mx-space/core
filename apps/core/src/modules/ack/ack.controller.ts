import { Body, HttpCode, Post, Res } from '@nestjs/common'
import type { FastifyReply } from 'fastify'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { RawResponse } from '~/common/response/raw-response.decorator'
import { ResponseV2 } from '~/common/response/v2-controller.decorator'
import { BusinessEvents } from '~/constants/business-event.constant'
import { WebEventsGateway } from '~/processors/gateway/web/events.gateway'
import { CountingService } from '~/processors/helper/helper.counting.service'

import { AckDto, AckEventType, AckReadPayloadSchema } from './ack.schema'

@ApiController('ack')
@ResponseV2()
export class AckController {
  constructor(
    private readonly countingService: CountingService,
    private readonly webGateway: WebEventsGateway,
  ) {}

  @Post('/')
  @HttpCode(200)
  @RawResponse
  async ack(@Body() body: AckDto, @Res() res: FastifyReply) {
    const { type, payload } = body

    switch (type) {
      case AckEventType.READ: {
        const result = AckReadPayloadSchema.safeParse(payload)
        if (!result.success) {
          const errorMessages = result.error.issues.map((err) => {
            const path = err.path.join('.')
            return path ? `${path}: ${err.message}` : err.message
          })
          throw createAppException(AppErrorCode.ACK_INVALID_PAYLOAD, { message: errorMessages.join('; ') })
        }

        const { id, type: articleType } = result.data
        const doc = await this.countingService.updateReadCount(articleType, id)

        if (doc) {
          this.webGateway.broadcast(BusinessEvents.ARTICLE_READ_COUNT_UPDATE, {
            count: doc.readCount,
            id,
            type: articleType,
          })
        }

        return res.send()
      }
    }
  }
}
