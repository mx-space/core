import { Body, HttpCode, Post, Res } from '@nestjs/common'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { BusinessEvents } from '~/constants/business-event.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { WebEventsGateway } from '~/processors/gateway/web/events.gateway'
import { CountingService } from '~/processors/helper/helper.counting.service'
import type { CountModel } from '~/shared/model/count.model'
import type { FastifyReply } from 'fastify'
import { AckDto, AckEventType, AckReadPayloadSchema } from './ack.schema'

@ApiController('ack')
export class AckController {
  constructor(
    private readonly countingService: CountingService,

    private readonly webGateway: WebEventsGateway,
  ) {}

  @Post('/')
  @HttpCode(200)
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
          throw new BizException(
            ErrorCodeEnum.InvalidBody,
            errorMessages.join('; '),
          )
        }

        const { id, type } = result.data
        const doc = await this.countingService.updateReadCount(type, id)

        if ('count' in doc)
          this.webGateway.broadcast(BusinessEvents.ARTICLE_READ_COUNT_UPDATE, {
            count: -~(
              doc as {
                count: CountModel
              }
            ).count.read!,
            id,
            type,
          })

        return res.send()
      }
    }
  }
}
